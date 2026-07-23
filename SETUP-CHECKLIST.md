# Before you start — setup checklist

## Accounts (all free to start)
- [ ] **GitHub** — hosts the code, connects to Vercel for auto-deploy
- [ ] **Vercel** — hosting (sign up with your GitHub account, it's one click)
- [ ] **balldontlie.io** — free API key for NBA games/stats: https://www.balldontlie.io/
- [ ] **A Redis provider via Vercel Marketplace** — for persistent Elo ratings/accuracy stats. Set up *after* your first deploy: Vercel dashboard → your project → Storage → Marketplace Database Providers → Redis → Create → Connect to project. This auto-injects `KV_REST_API_URL` / `KV_REST_API_TOKEN`.

## Local tools
- [ ] **Node.js 18.18+** (Next.js 14 requirement) — check with `node -v`
- [ ] **npm** (comes with Node) or `pnpm`/`yarn` if you prefer
- [ ] A code editor (VS Code is the common choice)
- [ ] `git` installed and a GitHub repo created for this project

## Before your first deploy
- [ ] `npm install` runs clean locally
- [ ] `cp .env.example .env.local`, fill in `BALLDONTLIE_API_KEY`, run `npm run dev` and confirm real games show up (not the sample-data banner)
- [ ] Decide on a `CRON_SECRET` value (any random string) — set it in `.env.local` and later in Vercel's env vars too, so nobody else can trigger `/api/evaluate`

## Before shipping publicly
- [ ] **Legal check for your region**: displaying score/outcome predictions is generally fine, but if you ever add real-money betting or affiliate links to sportsbooks, gambling is regulated differently by country/state — confirm what's required where your users are (age verification, licensing, disclaimers) before adding that
- [ ] Keep the responsible-gambling disclaimer in the footer (already in `app/page.tsx`) visible — don't remove it if you add betting-adjacent features
- [ ] Decide your balldontlie plan: the free tier has rate limits — check current limits against your expected traffic before launch (https://www.balldontlie.io/ pricing page)
- [ ] Test what the site looks like with **zero graded games yet** (fresh deploy) — the accuracy panel and win-rate feature only fill in after the first daily cron run

## Nice to have, not required to ship
- [ ] Custom domain (Vercel → Project → Domains)
- [ ] `vercel` CLI installed locally for quick manual deploys/logs (`npm i -g vercel`)
- [ ] Basic analytics (Vercel Analytics is one click to enable from the dashboard)
