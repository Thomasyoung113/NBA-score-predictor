// A standard Elo rating system, adapted for NBA scores.
// Every team starts at 1500. After each finished game, both ratings shift
// based on whether the result matched what the ratings expected — and by
// how much, via a margin-of-victory multiplier so a 40-point blowout moves
// ratings more than a 1-point nail-biter.

export const DEFAULT_RATING = 1500;
const K_FACTOR = 20;
const ELO_HOME_ADVANTAGE = 100; // rating-points equivalent of home court

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

// Elo-implied home win probability, folding in home-court advantage.
export function eloWinProbability(homeRating: number, awayRating: number): number {
  return expectedScore(homeRating + ELO_HOME_ADVANTAGE, awayRating);
}

export function updateRatings(
  homeRating: number,
  awayRating: number,
  homeScore: number,
  awayScore: number
): { homeRating: number; awayRating: number } {
  const homeWon = homeScore > awayScore;
  const expectedHome = eloWinProbability(homeRating, awayRating);
  const actualHome = homeWon ? 1 : 0;

  const margin = Math.abs(homeScore - awayScore);
  // Capped so one absurd blowout can't swing ratings too far on its own.
  const marginMultiplier = Math.min(1 + margin / 20, 1.5);

  const change = K_FACTOR * marginMultiplier * (actualHome - expectedHome);

  return {
    homeRating: round1(homeRating + change),
    awayRating: round1(awayRating - change),
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
