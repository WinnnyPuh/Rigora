# Rigora

Verified moving freight. Phase 1: instant carrier and broker check by USDOT or MC.

## How it works
- `public/index.html` — the site (EN / RU / ES, light and dark).
- `functions/api/check.js` — `GET /api/check?q=77949` or `?q=MC67234`. Runs on Cloudflare Pages Functions.
- `functions/_lib/fmcsa.js` — merges FMCSA QCMobile (insurance amounts, OOS rates, crashes,
  allowed-to-operate) with FMCSA Motus open data (per-authority filings, BOC-3, authority history,
  brand-new registrations). Results are cached for 6 hours.

## Deploy (Cloudflare Pages)
1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick this repo.
2. Build settings: Framework preset **None**, build command **empty**, output directory **public**.
3. Settings → Variables and Secrets → add `FMCSA_KEY` (type **Secret**) with your QCMobile web key.
   Optional: `SOCRATA_TOKEN` from data.transportation.gov.
4. Deploy. The site appears at `https://rigora.pages.dev` (or the name Cloudflare gives it).
5. Custom domain: Pages project → Custom domains → add e.g. `getrigora.com`.

## Local run
```
cp .dev.vars.example .dev.vars   # put your key in it
npx wrangler pages dev public
```

## Tests
```
node test/fmcsa.test.mjs
```
Uses real FMCSA responses captured in October 2026; no network or key needed.

## Roadmap
1. ✅ Company check
2. Trip planner on our own TomTom key; state miles computed on the server from state boundaries
3. Accounts (Supabase), plans, automatic verification on sign-up, owner admin page
4. Load board (beta), Stripe payments, mobile app
