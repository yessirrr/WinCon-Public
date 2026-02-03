# Removal Inventory - WinCon

This report documents the location and usage of features targeted for removal.

## A) Flash Economy command references

No explicit references to a "Flash Economy" command or any variation (flash-economy, flash_economy, etc.) were found in the current source code (`src/`) or scripts (`scripts/`).

**Searches performed:**
- `rg -n "flash economy|flashEconomy|flash_economy|flash-economy|flashEconom" src`
- `rg -n "commands|register|parser|slash|/flash" src/commands`

**Conclusion:** The Flash Economy command appears to have been already removed or was never implemented under these names.

## B) /overview pistol round economy references

The "Pistol Round Economy" tab/section in the `/overview` report is wired through several files.

| File Path | Line(s) | Description |
|-----------|---------|-------------|
| `src/analysis/reports/overviewReport.ts` | 220-225 | Defines the "Pistol Round Economy" section and populates it with `pistol-loadout` data. |
| `src/ui/screens/ReportViewScreen.tsx` | 98-99 | Maps the `pistol-loadout` content type to the `PistolLoadoutSection` component. |
| `src/ui/components/PistolLoadoutSection.tsx` | 93, 142 | Handles the 'U' hotkey and displays "Press U to expand/collapse". |
| `src/ui/components/PistolUtilityExactSection.tsx` | 132, 172 | Handles the 'U' hotkey and displays "Press U to expand/collapse" (related utility analysis). |
| `src/domain/pistolUtilityExact.ts` | 212 | Exports `buildPistolLoadoutData` used by the overview report. |

## C) Ability/shop cost references

References to ability costs and shop costs are found in data files, scripts, and domain logic.

| File Path | Line(s) | Description |
|-----------|---------|-------------|
| `data/Ability Cost.md` | All | Documentation of ability costs for all agents. |
| `data/valorant_shop_costs.csv` | All | CSV version of shop cost data. |
| `data/valorant_shop_costs.json` | All | JSON version of shop cost data used by the app. |
| `scripts/buildShopCosts.ts` | All | Script used to compile/generate shop cost data. |
| `src/domain/shopCosts.ts` | All | Domain logic for loading and accessing shop/ability costs. |
| `src/domain/pistolUtilityExact.ts` | 3, 44 | Imports `shopCosts.ts` and uses it to calculate utility spend in pistol rounds. |
| `package.json` | 12 | Defines `build:shop-costs` script. |
