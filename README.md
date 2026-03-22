# ☕ Coffee Inventory

A personal coffee inventory tracker with AI-powered bag scanning, optimized freezer portioning, espresso recipe logging, and dose tracking.

## Features

- **Scan** — Snap a photo of any coffee bag and the label is parsed automatically (country, variety, producer, roaster, process, weight, tasting notes, etc.)
- **Smart portioning** — Bags are auto-divided into 5–7 dose portions (~90–126g) with remainder distributed evenly as buffer. Zero waste.
- **Freezer management** — Track what's frozen, how many portions remain, when it was frozen
- **Active bag** — Pull a portion, tap through doses as you use them, log your espresso recipe (dose/yield/time/grind)
- **Archive** — Finished bags with ratings and recipes for future reference

## Stack

- Next.js 14 (Pages Router)
- Anthropic Claude API (vision for bag scanning)
- localStorage for data persistence
- No database needed — runs entirely client-side with one server-side API route for scanning

## Setup

```bash
# Clone and install
git clone <your-repo>
cd coffee-inventory
npm install

# Add your Anthropic API key
cp .env.local.example .env.local
# Edit .env.local and add your key from https://console.anthropic.com/settings/keys

# Run locally
npm run dev
# Open http://localhost:3000
```

## Deploy to Vercel

1. Push to GitHub
2. Import in [Vercel](https://vercel.com/new)
3. Add environment variable: `ANTHROPIC_API_KEY` = your key
4. Deploy

The app will be live at your Vercel URL. Add it to your phone's home screen for the full app experience.

## Portioning Logic

Given a bag weight, the engine:
1. Calculates total clean 18g doses
2. Finds the optimal combination of 5, 6, or 7 dose portions (90g–126g)
3. Distributes remainder grams evenly across all portions as buffer
4. Buffer absorbs grinder retention, slight over-dosing, transfer loss

Examples:
| Bag | Portions | Buffer |
|-----|----------|--------|
| 250g | 2 × (134g, 116g) | ~8g each |
| 300g | 3 × (112g, 94g, 94g) | ~4g each |
| 500g | 4 × (129g, 129g, 129g, 112g) | ~3.5g each |

## Data

All data stored in browser localStorage. No server database, no accounts, no tracking. Your coffee, your data.
