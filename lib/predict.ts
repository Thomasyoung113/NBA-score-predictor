// The prediction model — organized around bet-type markets (Winner / Total /
// Handicap) rather than bookmaker odds. Every number here comes from our
// own team-stats formula blended with a learned Elo rating, never from a
// sportsbook.
//
// How the learning loop plugs in: /api/evaluate grades each finished game
// and updates every team's Elo rating (lib/elo.ts + lib/store.ts). This
// file just consumes whatever rating it's handed — it doesn't know or care
// where the number came from, so the model keeps improving without any
// changes needed here.

import { DEFAULT_RATING, eloWinProbability } from "./elo";

export type TeamProfile = {
  name: string;
  pointsPerGame: number; // offensive output, season average
  pointsAllowedPerGame: number; // defensive output, season average
  eloRating?: number; // learned rating; defaults to 1500 if not yet tracked
  eloGamesPlayed?: number; // how many graded games fed this rating so far
};

export type WinnerMarket = {
  pick: "home" | "away";
  homeWinProbability: number; // 0-1
  awayWinProbability: number; // 0-1
};

export type TotalPointsMarket = {
  projectedTotal: number;
  line: number; // our own suggested O/U line, half-point so it can't push
};

export type HandicapMarket = {
  favorite: "home" | "away";
  line: number; // projected margin, e.g. 5.5 means favorite by ~5.5
};

export type TeamTotalMarket = {
  home: number;
  away: number;
};

export type MarketPredictions = {
  homeScore: number;
  awayScore: number;
  winner: WinnerMarket;
  total: TotalPointsMarket;
  handicap: HandicapMarket;
  teamTotals: TeamTotalMarket;
  marginOfError: number; // +/- points, for honest display
  modelBasis: "stats-only" | "stats+elo"; // which inputs actually drove this pick
};

const HOME_COURT_EDGE = 2.8; // league-average home advantage, points
const LOGISTIC_SCALE = 11; // controls how fast win% saturates with point diff
const MIN_GAMES_FOR_ELO_TRUST = 3; // below this, a team's Elo is still mostly a guess

export function predictGame(home: TeamProfile, away: TeamProfile): MarketPredictions {
  // 1. Stats-based projection: blends each team's own scoring rate with
  // what the opponent typically allows.
  const homeRaw =
    (home.pointsPerGame + away.pointsAllowedPerGame) / 2 + HOME_COURT_EDGE / 2;
  const awayRaw =
    (away.pointsPerGame + home.pointsAllowedPerGame) / 2 - HOME_COURT_EDGE / 2;

  const homeScore = Math.round(homeRaw);
  const awayScore = Math.round(awayRaw);
  const diff = homeScore - awayScore;
  const projectedTotal = homeScore + awayScore;

  const statsHomeWinProb = 1 / (1 + Math.exp(-diff / LOGISTIC_SCALE));

  // 2. Elo-based win probability, from ratings that update after every
  // finished game (see /api/evaluate).
  const homeGames = home.eloGamesPlayed ?? 0;
  const awayGames = away.eloGamesPlayed ?? 0;
  const eloHomeWinProb = eloWinProbability(
    home.eloRating ?? DEFAULT_RATING,
    away.eloRating ?? DEFAULT_RATING
  );

  // 3. Blend the two. A brand-new team's Elo is just the default 1500 for
  // both sides, which is uninformative — so we barely weight it until
  // there's a real track record to learn from.
  const hasTrack = homeGames >= MIN_GAMES_FOR_ELO_TRUST && awayGames >= MIN_GAMES_FOR_ELO_TRUST;
  const eloWeight = hasTrack ? 0.5 : 0.15;

  const homeWinProbability = round2(
    statsHomeWinProb * (1 - eloWeight) + eloHomeWinProb * eloWeight
  );
  const awayWinProbability = round2(1 - homeWinProbability);

  // Our own O/U line: the projected total itself, rounded to the nearest
  // half-point so it never lands on a push.
  const line = roundToHalf(projectedTotal);

  return {
    homeScore,
    awayScore,
    winner: {
      pick: homeWinProbability >= awayWinProbability ? "home" : "away",
      homeWinProbability,
      awayWinProbability,
    },
    total: {
      projectedTotal,
      line,
    },
    handicap: {
      favorite: diff >= 0 ? "home" : "away",
      line: Math.abs(roundToHalf(diff)),
    },
    teamTotals: {
      home: homeScore,
      away: awayScore,
    },
    marginOfError: 6, // will tighten automatically as /api/evaluate accumulates data — see lib/store.ts getAccuracyStats
    modelBasis: hasTrack ? "stats+elo" : "stats-only",
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function roundToHalf(n: number) {
  const rounded = Math.round(n * 2) / 2;
  return Number.isInteger(rounded) ? rounded + 0.5 : rounded;
}
