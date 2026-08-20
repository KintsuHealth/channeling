# ☕ Expertso

A personal coffee inventory tracker with AI-powered bag scanning, optimized freezer portioning, a learning grind predictor, espresso + pour-over recipe logging, and a museum-style archive.

## Features

- **Scan** — Snap a photo of any coffee bag and the label is parsed automatically (country, variety, producer, roaster, process, weight, tasting notes, etc.)
- **Smart portioning** — Bags are auto-divided into 5–7 dose portions with remainder distributed evenly as buffer. Zero waste.
- **Freezer management** — Track what's frozen, portion-level pulls (choose exactly which portion, e.g. the odd 36g one), sorting, recipes-at-a-glance
- **Now Brewing** — The home hero shows the active bag's art, characteristics and tasting notes, with the recipe stack and dose tracker
- **Learning grind predictor** — Heuristics (roast/process/altitude/variety/freshness) plus a personal calibration that recency-weights your actual dial-ins, compares a new bag against the previous bag of the same coffee, and adjusts for freshness differences
- **Equipment-aware** — Select your machine (Slayer Single Group, Linea Mini, Linea Micra, GS3, Breville Barista) and portafilter basket (Slayer stock 18g, Weber Unifilter 20g). Recipes are tagged with the setup they were dialed on; the app learns the grind delta between setups from paired shots and translates archived dial-ins to your current basket
- **AI dial-in** — Machine-specific espresso guidance (pre-brew/full-throttle on the Slayer, paddle technique on a GS3 MP, grind/ratio/temp on the Lineas) and pour-over recipes for Origami, V60, Kalita and Chemex
- **The Museum** — Finished bags hang as works in seasonal exhibitions: framed bag art, placards with origin, tenure (acquired → consumed), the dial-in story, and the grind translated to your current setup

## Stack

- Next.js 14 (Pages Router)
- Anthropic Claude API (vision scanning + dial-in guidance)
- Supabase (auth, Postgres, storage) — see `supabase-schema.sql`
- Noto Sans JP / Noto Sans Mono design system

## Setup

```bash
npm install
cp .env.local.example .env.local   # add ANTHROPIC_API_KEY + Supabase keys
npm run dev
```

### Database migrations

Run `supabase-schema.sql` once for a fresh project. For an existing database, the commented `-- Migration:` blocks at the bottom of that file must be run in the Supabase SQL editor. Latest:

```sql
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS machine_id TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS basket_id TEXT;
```

(Until it runs, equipment choices persist in localStorage.)

## Deploy to Vercel

1. Push to GitHub
2. Import in [Vercel](https://vercel.com/new)
3. Add environment variables: `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

## Grind model

Suggested grind = baseline + bean offset + personal calibration (+ equipment delta).

- **Bean offset** — roast level, process, altitude, variety density, and a continuous days-off-roast degas curve, with a light-roast × ferment interaction term
- **Personal calibration** — the residual between what the model predicted and where you actually settled, exponentially recency-weighted (half-life ~30 days) and quality-weighted (favorites/4★+ count more), so the model follows your averages as they drift
- **Previous-bag anchor** — a new bag of a coffee you've dialed before starts from where the last bag settled, adjusted for the freshness difference between the two bags
- **Equipment translation** — deltas between machine/basket setups start from physical priors (e.g. Unifilter 20g ≈ 0.2 coarser) and are replaced by learned paired-shot deltas as you dial the same coffees on both
