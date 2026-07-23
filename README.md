# Court Line — NBA Score Predictor

A statistical NBA score predictor built with Next.js + Tailwind, ready to deploy on Vercel.

## What's here

- `app/page.tsx` — homepage: model track record + upcoming games with predicted picks
- `app/api/games/route.ts` — server route that pulls games + stats + Elo ratings, runs the prediction model, and saves each prediction so it can be graded later
- `app/api/evaluate/route.ts` — **the learning loop.** Checks recently finished games, updates Elo ratings from the real results, and grades any predictions that were saved for those games. Meant to run daily via Vercel Cron (see `vercel.json`).
- `app/api/accuracy/route.ts` — running accuracy stats (winner hit rate, avg point error) read by the homepage
- `lib/predict.ts` — the prediction model: stats formula blended with Elo, once a team has enough graded games for Elo to mean something
- `lib/elo.ts` — the Elo rating math (expected score, margin-of-victory-weighted update)
- `lib/store.ts` — persistence for ratings, pending predictions, and the accuracy log (Upstash Redis in production, in-memory in local dev)
- `lib/balldontlie.ts` — client for the [balldontlie.io](https://www.balldontlie.io/) API (free tier: games, team stats, finished-game scores)
- `components/GameCard.tsx` / `components/AccuracyPanel.tsx` — UI

Runs on **sample data out of the box** — no key required to preview it.

## How the learning loop works

1. `/api/games` predicts an upcoming game and **saves the prediction** (predicted score, predicted winner) keyed by game ID.
2. Once that game is final, the daily cron hits `/api/evaluate`, which:
   - Looks up the real score from balldontlie
   - Updates both teams' **Elo ratings** based on whether the result matched what their ratings expected (and by how much — blowouts move ratings more than nail-biters)
   - Compares the saved prediction to the real result and logs whether the winner pick was right, and how far off the total/margin were
3. Future predictions for those teams automatically use the updated Elo ratings — no manual retraining step. A team needs at least 3 graded games before its Elo carries real weight in the blend; before that, the model leans on the stats formula alone.
4. The homepage shows the running track record (winner accuracy %, average point error) so you can see the model actually improving — or not — over time, instead of just trusting it blindly.

## Why balldontlie instead of Sportybet / football.com

Sportybet and football.com are betting operators, not open data providers — there's no public API to pull odds or results from them, and scraping a betting site would violate its terms of service. balldontlie.io gives real NBA games, team stats, and finished-game scores through one free-tier key, which is what the learning loop needs (predicted vs. actual results) — it was never about matching their odds numbers.

## Setup

```bash
npm install
cp .env.example .env.local
# add your free key from https://balldontlie.io to .env.local
npm run dev
```

Visit `http://localhost:3000`. Locally, ratings/predictions live in memory and reset on restart — that's fine for development, but you'll want real persistence in production (next section).

## Deploy to Vercel

1. Push this folder to a GitHub repo, import it on vercel.com
2. Add `BALLDONTLIE_API_KEY` in Project Settings → Environment Variables
3. **Set up persistence:** Vercel dashboard → Storage → Marketplace Database Providers → Redis → Create, then connect it to this project. This injects `KV_REST_API_URL` / `KV_REST_API_TOKEN` automatically — without this, ratings won't survive between requests in production.
4. (Optional but recommended) Set `CRON_SECRET` to a random string in both `.env.local` and Vercel's env vars — this stops anyone else from triggering `/api/evaluate` directly.
5. Deploy. The cron in `vercel.json` runs `/api/evaluate` daily at 9am UTC automatically — no extra setup needed on Vercel's side.

## Roadmap

**Phase 1 — Foundation** ✅
- [x] Next.js + Tailwind + Vercel-ready structure
- [x] v1 prediction model (points-for / points-against differential + home edge)
- [x] Bet-type UI: Winner, Total, Handicap

**Phase 2 — Learning loop** ✅
- [x] Elo ratings that update after every finished game
- [x] Daily evaluation job comparing predictions to real outcomes
- [x] Accuracy tracking surfaced on the homepage

**Phase 3 — Model quality**
- [ ] Pull real opponent-points-allowed per team instead of a flat placeholder
- [ ] Tune the Elo K-factor and margin multiplier against a season of backtested results
- [ ] Move `marginOfError` from a hardcoded placeholder to the live `avgTotalError` from `/api/accuracy`
- [ ] Factor in rest days, back-to-backs, and injuries (injury feeds are usually a paid add-on)
- [ ] Quarter 1X2 / 1st-half markets, once a data source with period-level splits is added

**Phase 4 — Polish & scale**
- [ ] A "recent grades" page listing individual graded predictions, not just aggregate stats
- [ ] Team logos, standings page, filters (by conference/date)
- [ ] Mobile pass, loading/error states
- [ ] Optional: user accounts to save favorite teams

## Disclaimer

This tool produces statistical projections for informational purposes — it is not betting advice, and it doesn't guarantee outcomes. The accuracy panel shows the model's real track record precisely so it isn't taken on faith. Sports betting is regulated differently by region; confirm it's legal where you (and your users) are before adding real-money features. Consider adding a responsible-gambling notice and age-gate if you go live publicly.
