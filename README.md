# WinCon

## Judges Quick Start (Offline Demo)
**Do not install anything and do not run any build commands.**

1. Download or clone this repository to a Windows machine.
2. Open `WinCon_JudgePack/`.
3. Double-click `Run WinCon (Demo).bat`.
4. Use arrow keys + Enter to navigate, and press `q` to quit.

The demo is fully offline: it uses bundled runtime files and pre-cached data (no internet required).

## What WinCon Is
WinCon is a terminal-based VALORANT scouting console that pulls team/player match data, computes scouting intelligence (overview, pistol performance, momentum, economy, pause timing, and win-condition signals), and presents the results in a fast, keyboard-driven interface built for analyst workflows.

## What the Judges Are Looking At
- `WinCon_JudgePack/` is a runnable snapshot of the project for judging. It includes a bundled Node runtime, compiled app, dependencies, and demo cache so it starts immediately.
- `src/`, `scripts/`, `docs/`, and `data/raw/` contain the full implementation and logic used to produce the demo.
- **Demo mode vs Live mode:**
  - **Demo mode:** `Run WinCon (Demo).bat` sets offline mode and reads `WinCon_JudgePack/app/data/cache/demo/` only.
  - **Live mode:** `Run WinCon (Live).bat` uses live GRID APIs and requires internet + a local `.env` file (not included in this public repo).

## Codebase Overview
- `src/index.tsx`, `src/App.tsx` - app entry and top-level Ink/React shell.
- `src/ui/` - screens, router, components, and state store for terminal interaction.
- `src/commands/` - slash-command parsing/dispatch (`/overview`, `/pistol`, `/wincon`, filters, export, refresh).
- `src/data/` - GRID API client, cache layer, models, and data orchestration.
- `src/analysis/` - report generators and round/momentum analytics.
- `src/domain/` - economy inference, pause-value model, tactical/round adapters.
- `src/rendering/exporters/` - markdown export pipeline.
- `docs/INTELLIGENCE_LOGIC.md` - model assumptions and intelligence logic notes.
- `scripts/build-judge-pack.js` - packaging script for Judge Pack generation.

## Optional Developer Setup (Not Required for Judging)
1. Install Node.js 20+.
2. Copy `.env.example` to `.env` and add a valid `GRID_API_KEY` for live data.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run locally:
   ```bash
   npm run dev
   ```

Optional production build:
```bash
npm run build
npm start
```