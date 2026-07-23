import { NextRequest, NextResponse } from "next/server";
import { getRecentFinishedGames } from "@/lib/balldontlie";
import { updateRatings } from "@/lib/elo";
import {
  getTeamRating,
  setTeamRating,
  getPendingPrediction,
  deletePendingPrediction,
  wasGameProcessed,
  markGameProcessed,
  recordEvaluation,
} from "@/lib/store";

// This is the "after each game, check the prediction against the outcome"
// loop. Wire it up as a Vercel Cron (see vercel.json) to run automatically
// once a day, after the previous night's games have gone final.
//
// It does two independent things for every finished game:
//   1. Updates both teams' Elo ratings from the real result — this happens
//      for every finished game, whether or not we'd made a prediction for
//      it, so ratings stay accurate even for games predicted before the
//      app existed or during downtime.
//   2. If we DID save a prediction for that game, grades it (winner
//      correct? how far off was the total/margin?) and logs it to the
//      accuracy stats shown on the homepage.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  if (!process.env.BALLDONTLIE_API_KEY) {
    return NextResponse.json(
      { skipped: true, reason: "No BALLDONTLIE_API_KEY set — nothing to evaluate against." },
      { status: 200 }
    );
  }

  const finishedGames = await getRecentFinishedGames(2);
  let eloUpdated = 0;
  let graded = 0;

  for (const game of finishedGames) {
    if (await wasGameProcessed(game.id)) continue;

    const homeScore = game.home_team_score;
    const awayScore = game.visitor_team_score;

    // 1. Elo update from the real result, regardless of whether we had a
    // saved prediction for this game.
    const homeRatingInfo = await getTeamRating(game.home_team.id);
    const awayRatingInfo = await getTeamRating(game.visitor_team.id);
    const updated = updateRatings(
      homeRatingInfo.rating,
      awayRatingInfo.rating,
      homeScore,
      awayScore
    );
    await setTeamRating(game.home_team.id, updated.homeRating, homeRatingInfo.gamesPlayed + 1);
    await setTeamRating(game.visitor_team.id, updated.awayRating, awayRatingInfo.gamesPlayed + 1);
    eloUpdated++;

    // 2. Grade our prediction, if one exists for this game.
    const pending = await getPendingPrediction(game.id);
    if (pending) {
      const actualWinner: "home" | "away" = homeScore > awayScore ? "home" : "away";
      const predictedTotal = pending.predictedHomeScore + pending.predictedAwayScore;
      const actualTotal = homeScore + awayScore;
      const predictedMargin = pending.predictedHomeScore - pending.predictedAwayScore;
      const actualMargin = homeScore - awayScore;

      await recordEvaluation({
        gameId: game.id,
        date: game.date,
        matchup: `${pending.awayTeamName} @ ${pending.homeTeamName}`,
        predictedWinner: pending.predictedWinner,
        actualWinner,
        winnerCorrect: pending.predictedWinner === actualWinner,
        predictedTotal,
        actualTotal,
        totalError: Math.abs(predictedTotal - actualTotal),
        marginError: Math.abs(predictedMargin - actualMargin),
        evaluatedAt: new Date().toISOString(),
      });

      await deletePendingPrediction(game.id);
      graded++;
    }

    await markGameProcessed(game.id);
  }

  return NextResponse.json({
    finishedGamesChecked: finishedGames.length,
    eloRatingsUpdated: eloUpdated,
    predictionsGraded: graded,
  });
}
