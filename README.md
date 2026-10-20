# Rigora

Verified moving freight. Phase 1: instant carrier and broker check by USDOT or MC.

## How it works
- `public/index.html` — the site (EN / RU / ES, light and dark).
- `functions/api/check.js` — `GET /api/check?q=77949` or `?q=MC67234`. Runs on Cloudflare Pages Functions.
- `functions/_lib/fmcsa.js` — merges FMCSA QCMobile (insurance amounts, OOS rates, crashes,
  allowed-to-operate) with FMCSA Motus open data (per-authority filings, BOC-3, authority history,
  brand-new registrations). Results are cached for 6 hours.

## Deploy on Cloudflare (either way works)
**Worker (default in the new dashboard):** Workers & Pages → Create → Import a repository → pick this repo →
leave the build command empty and the deploy command `npx wrangler deploy` → Deploy.
Then the Worker → Settings → Variables and Secrets → add `FMCSA_KEY` as a **Secret** → redeploy.

**Pages:** Workers & Pages → Create → Pages → Connect to Git → pick this repo → Framework **None**,
build command **empty**, output directory **public** → add `FMCSA_KEY` as a secret → Deploy.

Optional secret: `SOCRATA_TOKEN` (data.transportation.gov app token, raises rate limits).
Custom domain: the project → Domains → add e.g. `getrigora.com`.

## Local run
```
cp .dev.vars.example .dev.vars   # put your key in it
npx wrangler dev
```

## Tests
```
node test/fmcsa.test.mjs && node test/worker.test.mjs
```
Uses real FMCSA responses captured in October 2026; no network or key needed.

## Roadmap
1. ✅ Company check
2. Trip planner on our own TomTom key; state miles computed on the server from state boundaries
3. Accounts (Supabase), plans, automatic verification on sign-up, owner admin page
4. Load board (beta), Stripe payments, mobile app
