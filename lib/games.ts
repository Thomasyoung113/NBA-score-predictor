// Shared logic for building the games+predictions list, used directly by
// the homepage (Server Component) and by /api/games (for anyone who wants
// to hit the JSON endpoint directly, e.g. a future mobile app).
//
// Server Components should call getGamesData() directly rather than
// fetching /api/games over HTTP — an internal HTTP round-trip to your own
// deployment can hit Vercel's deployment-protection / auth layer and come
// back as an HTML page instead of JSON, which is a common source of
// confusing 500s. Calling the function in-process avoids that entirely.

import { getUpcomingGames, getTeamSeasonStats } from "@/lib/balldontlie";
import { predictGame, type TeamProfile, type MarketPredictions } from "@/lib/predict";
import { getTeamRating, savePendingPrediction } from "@/lib/store";

export type GameResult = {
  id: number;
  date: string;
  home: string;
  away: string;
  prediction: MarketPredictions;
  source: string;
};

// Used when BALLDONTLIE_API_KEY isn't set yet, so the app works out of the box.
const MOCK_GAMES = [
  {
    id: 1,
    date: new Date(Date.now() + 86400000).toISOString(),
    home: { id: 1001, name: "Boston Celtics", pointsPerGame: 120.6, pointsAllowedPerGame: 109.2 },
    away: { id: 1002, name: "New York Knicks", pointsPerGame: 115.1, pointsAllowedPerGame: 111.4 },
  },
  {
    id: 2,
    date: new Date(Date.now() + 172800000).toISOString(),
    home: { id: 1003, name: "Denver Nuggets", pointsPerGame: 118.3, pointsAllowedPerGame: 113.0 },
    away: { id: 1004, name: "Oklahoma City Thunder", pointsPerGame: 121.9, pointsAllowedPerGame: 108.5 },
  },
  {
    id: 3,
    date: new Date(Date.now() + 172800000).toISOString(),
    home: { id: 1005, name: "LA Lakers", pointsPerGame: 116.8, pointsAllowedPerGame: 114.2 },
    away: { id: 1006, name: "Golden State Warriors", pointsPerGame: 117.5, pointsAllowedPerGame: 112.9 },
  },
];

export async function getGamesData(): Promise<{
  games: GameResult[];
  source: string;
  error?: string;
}> {
  const hasKey = !!process.env.BALLDONTLIE_API_KEY;

  if (!hasKey) {
    const games = await Promise.all(
      MOCK_GAMES.map(async (g) => {
        const homeRating = await getTeamRating(g.home.id);
        const awayRating = await getTeamRating(g.away.id);
        const home: TeamProfile = {
          ...g.home,
          eloRating: homeRating.rating,
          eloGamesPlayed: homeRating.gamesPlayed,
        };
        const away: TeamProfile = {
          ...g.away,
          eloRating: awayRating.rating,
          eloGamesPlayed: awayRating.gamesPlayed,
        };
        const prediction = predictGame(home, away);

        await savePendingPrediction({
          gameId: g.id,
          homeTeamId: g.home.id,
          awayTeamId: g.away.id,
          homeTeamName: g.home.name,
          awayTeamName: g.away.name,
          predictedHomeScore: prediction.homeScore,
          predictedAwayScore: prediction.awayScore,
          predictedWinner: prediction.winner.pick,
          createdAt: new Date().toISOString(),
        });

        return { id: g.id, date: g.date, home: g.home.name, away: g.away.name, prediction, source: "mock" };
      })
    );
    return { games, source: "mock" };
  }

  try {
    const season =
      new Date().getMonth() >= 9 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    const upcoming = await getUpcomingGames(7);

    const games = await Promise.all(
      upcoming.map(async (g) => {
        const [homeStats, awayStats, homeRating, awayRating] = await Promise.all([
          getTeamSeasonStats(g.home_team.id, season),
          getTeamSeasonStats(g.visitor_team.id, season),
          getTeamRating(g.home_team.id),
          getTeamRating(g.visitor_team.id),
        ]);

        const home: TeamProfile = {
          name: g.home_team.full_name,
          pointsPerGame: homeStats?.[0]?.pts ?? 112,
          pointsAllowedPerGame: 112,
          eloRating: homeRating.rating,
          eloGamesPlayed: homeRating.gamesPlayed,
        };
        const away: TeamProfile = {
          name: g.visitor_team.full_name,
          pointsPerGame: awayStats?.[0]?.pts ?? 112,
          pointsAllowedPerGame: 112,
          eloRating: awayRating.rating,
          eloGamesPlayed: awayRating.gamesPlayed,
        };

        const prediction = predictGame(home, away);

        await savePendingPrediction({
          gameId: g.id,
          homeTeamId: g.home_team.id,
          awayTeamId: g.visitor_team.id,
          homeTeamName: home.name,
          awayTeamName: away.name,
          predictedHomeScore: prediction.homeScore,
          predictedAwayScore: prediction.awayScore,
          predictedWinner: prediction.winner.pick,
          createdAt: new Date().toISOString(),
        });

        return { id: g.id, date: g.date, home: home.name, away: away.name, prediction, source: "balldontlie" };
      })
    );

    return { games, source: "balldontlie" };
  } catch (err) {
    return { games: [], source: "error", error: (err as Error).message };
  }
}
