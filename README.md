# Mewgenics Hoard

> [!WARNING]
> **This project is no longer maintained.** It is archived as-is — bugs and outdated game data will not be fixed. Feel free to fork it if you want to keep it alive.

A community-built companion tool for [Mewgenics](https://store.steampowered.com/app/1220290/Mewgenics/) — manage your item storage, plan cat loadouts, and import items straight from game screenshots.

**Live:** <https://mewgenics-hoard.pages.dev>

Not affiliated with or endorsed by the game's developers. All game data is sourced from the community-run [Mewgenics Codex](https://mewcodex.github.io/).

## Features

- **Storage tab** — Add/remove items, see keep/maybe/trash verdicts per item, filter & search
- **Cats tab** — Create cats, equip 5 slots, set Item Proxy level, see active set bonuses
- **Sets tab** — Browse all 101 sets, mark planned sets, track collection progress
- **Import tab** — Drop a game screenshot, auto-detect the item grid, match icons via perceptual hashing
- **Data tab** — Export/import JSON backup, reset tracker

All state lives in your browser's localStorage — no account, no server, works offline.

## Tech Stack

- React 19 + TypeScript (strict)
- Vite + Tailwind CSS v4
- TanStack Router (file-based routing)
- Zustand (persisted to localStorage)
- shadcn/ui components
- Perceptual hashing (dHash) for screenshot import

## Getting Started

```bash
pnpm install
pnpm dev
```

## Scripts

| Command | Description |
| --------- | ------------- |
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm test` | Run Vitest tests |
| `pnpm lint` | Run ESLint |

### Data scripts (run once during dev)

| Script | Description |
| -------- | ------------- |
| `node scripts/split-dataset.mjs` | Re-split items + sets from mewcodex source |
| `node scripts/copy-icons.mjs` | Copy item icon PNGs into `public/icons/` |
| `node scripts/generate-hashes.mjs` | Generate perceptual hashes for icon matching |

## Project Structure

```
public/
├── data/
│   ├── items.json          # 1131 items (compact 7-element tuples)
│   ├── sets.json           # 101 sets
│   └── icon_hashes.json    # dHash DB for screenshot import
├── icons/                  # Item icon PNGs by slot kind
│   ├── head/
│   ├── face/
│   ├── neck/
│   ├── trinket/
│   └── weapon/
└── manifest.json
src/
├── components/
│   ├── ConfirmDialog.tsx
│   ├── ItemIcon.tsx        # Icon primitive with rarity ring
│   ├── ItemPicker.tsx
│   ├── Pills.tsx
│   └── StorageBits.tsx
├── lib/
│   ├── data.ts             # Dataset loader + lookups
│   ├── grid-detect.ts      # Canvas grid detection
│   ├── phash.ts            # dHash + hamming distance
│   ├── setbonus.ts         # Set bonus calculation
│   ├── useDataset.ts
│   ├── utils.ts
│   └── verdict.ts          # Keep/maybe/trash logic
├── routes/
│   ├── __root.tsx
│   ├── index.tsx           # Storage tab
│   ├── cats.tsx
│   ├── sets.tsx
│   ├── import.tsx          # Screenshot import
│   └── data.tsx
├── stores/
│   └── tracker.ts          # Zustand store (localStorage)
└── types.ts
```

## Screenshot Import

The Import tab lets you bulk-add items from a game screenshot:

1. Drop or select a storage screenshot (PNG/JPG)
2. Auto-detect the item grid, or manually set grid parameters
3. Each cell is hashed (dHash 8x8) and matched against the pre-computed icon hash DB
4. Review matches with confidence scores, adjust if needed
5. Click "Add all to storage" to bulk-import

The matching uses perceptual hashing (64-bit dHash) with Hamming distance comparison. Threshold is 12 bits (81% similarity) for candidate inclusion.

## Data Pipeline

Item data comes from the community-run [Mewgenics Codex](https://github.com/mewcodex/mewcodex.github.io):

1. `items_db.json` + `set_bonuses_db.json` → `split-dataset.mjs` → compact tuples in `public/data/`
2. `<Kind>ItemIcon/<frame>.png` → `copy-icons.mjs` → `public/icons/<kind>/<frame>.png`
3. Icons → `generate-hashes.mjs` (sharp + dHash) → `public/data/icon_hashes.json`

## Deployment

Static site on Cloudflare Pages. CI (GitHub Actions) only lints/typechecks/tests/builds — deployment is manual and done once:

```bash
pnpm build
npx wrangler pages deploy dist --branch main
```

The Pages project name and build output are configured in `wrangler.toml`.

## Credits

- Game data & icons: [Mewgenics Codex](https://mewcodex.github.io/) by the community
- Mewgenics by [Edmund McMillen](https://edmundmcmillen.com/) & [Tyler Glaiel](https://twitter.com/TylerGlaiel)

## License

MIT
