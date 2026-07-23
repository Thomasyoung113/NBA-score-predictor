// Thin client for the balldontlie.io API.
// Free tier covers NBA games, team season averages, and finished-game scores.
// Get a key at https://balldontlie.io and set BALLDONTLIE_API_KEY in .env.local

const BASE_URL = "https://api.balldontlie.io/v1";
const KEY = process.env.BALLDONTLIE_API_KEY;

async function bdl(path: string, revalidate = 900) {
  if (!KEY) {
    throw new Error(
      "Missing BALLDONTLIE_API_KEY. Add it to .env.local (see .env.example)."
    );
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: KEY },
    next: { revalidate },
  });
  if (!res.ok) {
    throw new Error(`balldontlie request failed: ${res.status} ${path}`);
  }
  return res.json();
}

export type BdlTeam = {
  id: number;
  full_name: string;
  abbreviation: string;
};

export type BdlGame = {
  id: number;
  date: string;
  home_team: BdlTeam;
  visitor_team: BdlTeam;
  status: string; // e.g. "Final", or a start time like "7:30 pm ET" if upcoming
  home_team_score: number;
  visitor_team_score: number;
};

// Upcoming games in the next N days
export async function getUpcomingGames(days = 7): Promise<BdlGame[]> {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + days);
  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];

  const data = await bdl(
    `/games?start_date=${startStr}&end_date=${endStr}&per_page=25`
  );
  return data.data as BdlGame[];
}

// Finished games in the last N days — used by the evaluation job to grade
// past predictions and update Elo ratings. Short cache so a same-day cron
// re-run still sees fresh "Final" statuses.
export async function getRecentFinishedGames(daysBack = 2): Promise<BdlGame[]> {
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  const end = new Date();
  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];

  const data = await bdl(
    `/games?start_date=${startStr}&end_date=${endStr}&per_page=100`,
    60
  );
  return (data.data as BdlGame[]).filter((g) => g.status === "Final");
}

// Season averages used as inputs to the prediction model
export async function getTeamSeasonStats(teamId: number, season: number) {
  const data = await bdl(
    `/season_averages?season=${season}&team_ids[]=${teamId}`
  );
  return data.data;
}
