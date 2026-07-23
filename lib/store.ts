// Persistence layer for everything the learning loop needs to remember
// between requests: each team's Elo rating, predictions we've made but
// haven't graded yet, and running accuracy stats.
//
// Vercel functions are stateless, so this needs real storage in production.
// We use Upstash Redis through Vercel's Marketplace Storage integration
// (Vercel KV itself was sunset in favor of this — same idea, new name).
// Set up: Vercel dashboard → Storage → Marketplace Database Providers →
// Redis → connect to this project. It injects KV_REST_API_URL /
// KV_REST_API_TOKEN automatically.
//
// Locally, or if no Redis is configured, this falls back to an in-memory
// store so `npm run dev` still works — but it resets on every restart, so
// don't rely on it for real learning outside of production.

import { DEFAULT_RATING } from "./elo";

type PendingPrediction = {
  gameId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  predictedWinner: "home" | "away";
  createdAt: string;
};

export type EvaluatedResult = {
  gameId: number;
  date: string;
  matchup: string;
  predictedWinner: "home" | "away";
  actualWinner: "home" | "away";
  winnerCorrect: boolean;
  predictedTotal: number;
  actualTotal: number;
  totalError: number;
  marginError: number;
  evaluatedAt: string;
};

export type AccuracyStats = {
  gamesEvaluated: number;
  winnerAccuracy: number; // 0-1
  avgTotalError: number;
  avgMarginError: number;
};

let redisClient: import("@upstash/redis").Redis | null = null;
let redisChecked = false;

async function getRedis() {
  if (redisChecked) return redisClient;
  redisChecked = true;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const { Redis } = await import("@upstash/redis");
  redisClient = new Redis({ url, token });
  return redisClient;
}

// --- in-memory fallback (dev only) -----------------------------------
const memRatings = new Map<number, { rating: number; gamesPlayed: number }>();
const memPending = new Map<number, PendingPrediction>();
const memProcessed = new Set<number>();
const memAccuracyLog: EvaluatedResult[] = [];

// --- Elo ratings --------------------------------------------------------

export async function getTeamRating(
  teamId: number
): Promise<{ rating: number; gamesPlayed: number }> {
  const redis = await getRedis();
  if (!redis) {
    return memRatings.get(teamId) ?? { rating: DEFAULT_RATING, gamesPlayed: 0 };
  }
  const data = await redis.get<{ rating: number; gamesPlayed: number }>(
    `rating:${teamId}`
  );
  return data ?? { rating: DEFAULT_RATING, gamesPlayed: 0 };
}

export async function setTeamRating(
  teamId: number,
  rating: number,
  gamesPlayed: number
): Promise<void> {
  const redis = await getRedis();
  const value = { rating, gamesPlayed };
  if (!redis) {
    memRatings.set(teamId, value);
    return;
  }
  await redis.set(`rating:${teamId}`, value);
}

// --- pending predictions --------------------------------------------

export async function savePendingPrediction(p: PendingPrediction): Promise<void> {
  const redis = await getRedis();
  if (!redis) {
    memPending.set(p.gameId, p);
    return;
  }
  await redis.set(`pending:${p.gameId}`, p);
}

export async function getPendingPrediction(
  gameId: number
): Promise<PendingPrediction | null> {
  const redis = await getRedis();
  if (!redis) {
    return memPending.get(gameId) ?? null;
  }
  return (await redis.get<PendingPrediction>(`pending:${gameId}`)) ?? null;
}

export async function deletePendingPrediction(gameId: number): Promise<void> {
  const redis = await getRedis();
  if (!redis) {
    memPending.delete(gameId);
    return;
  }
  await redis.del(`pending:${gameId}`);
}

// --- idempotency: don't re-grade the same finished game twice ----------

export async function wasGameProcessed(gameId: number): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return memProcessed.has(gameId);
  return (await redis.get(`processed:${gameId}`)) != null;
}

export async function markGameProcessed(gameId: number): Promise<void> {
  const redis = await getRedis();
  if (!redis) {
    memProcessed.add(gameId);
    return;
  }
  await redis.set(`processed:${gameId}`, true);
}

// --- accuracy log + running stats --------------------------------------

export async function recordEvaluation(result: EvaluatedResult): Promise<void> {
  const redis = await getRedis();
  if (!redis) {
    memAccuracyLog.push(result);
    return;
  }
  await redis.rpush("accuracy:log", JSON.stringify(result));
  // keep the log from growing unbounded
  await redis.ltrim("accuracy:log", -500, -1);
}

export async function getAccuracyStats(): Promise<AccuracyStats> {
  const redis = await getRedis();
  let log: EvaluatedResult[];

  if (!redis) {
    log = memAccuracyLog;
  } else {
    const raw = await redis.lrange<string>("accuracy:log", 0, -1);
    log = raw.map((r) => (typeof r === "string" ? JSON.parse(r) : r));
  }

  if (log.length === 0) {
    return { gamesEvaluated: 0, winnerAccuracy: 0, avgTotalError: 0, avgMarginError: 0 };
  }

  const correct = log.filter((r) => r.winnerCorrect).length;
  const totalErrorSum = log.reduce((sum, r) => sum + r.totalError, 0);
  const marginErrorSum = log.reduce((sum, r) => sum + r.marginError, 0);

  return {
    gamesEvaluated: log.length,
    winnerAccuracy: round2(correct / log.length),
    avgTotalError: round1(totalErrorSum / log.length),
    avgMarginError: round1(marginErrorSum / log.length),
  };
}

export async function getRecentForm(limit = 10): Promise<boolean[]> {
  const redis = await getRedis();
  let log: EvaluatedResult[];

  if (!redis) {
    log = memAccuracyLog;
  } else {
    const raw = await redis.lrange<string>("accuracy:log", -limit, -1);
    log = raw.map((r) => (typeof r === "string" ? JSON.parse(r) : r));
  }

  return log.slice(-limit).map((r) => r.winnerCorrect);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}
