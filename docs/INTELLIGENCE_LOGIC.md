# Intelligence Logic Documentation

This document explains the analytical models implemented in WinCon for scouting Valorant teams and players. All logic described here is **Implemented** unless explicitly marked as **Heuristic / Planned**.

---

## Table of Contents

1. [Scope and Data Inputs](#scope-and-data-inputs)
2. [Economy & Pause Intelligence (v1.1)](#economy--pause-intelligence-v11)
   - [Economy State Definitions](#economy-state-definitions)
   - [Buy Classification](#buy-classification)
   - [Economy Inference Algorithm](#economy-inference-algorithm)
   - [Pause Value Model](#pause-value-model)
   - [Tactical Proxies](#tactical-proxies)
   - [Output Structures](#output-structures)
3. [Round Outcome & Momentum (v1.0)](#round-outcome--momentum-v10)
   - [Round Type Definitions](#round-type-definitions)
   - [Side Performance](#side-performance)
   - [Pistol Analysis](#pistol-analysis)
   - [Streak Analysis](#streak-analysis)
   - [Heat Zones](#heat-zones)
   - [Conditional Signals](#conditional-signals)
4. [Limitations](#limitations)
5. [Developer Notes](#developer-notes)

---

## Scope and Data Inputs

### Data Source

All intelligence is derived from **GRID API** match data. The system uses only directly observable fields:

| Field | Source | Used For |
|-------|--------|----------|
| `round.winnerId` | GRID | Round outcomes, streaks, win rates |
| `round.side[teamId]` | GRID | Side classification (attacker/defender) |
| `round.roundNumber` | GRID | Round type classification, heat zones |
| `round.duration` | GRID | Tactical proxy inference |
| `round.economy[].loadoutValue` | GRID | Team-level economy (not per-player) |
| `round.playerStats[].kills/deaths` | GRID | Survivor count inference |

### What We Do NOT Have

- Per-player credit balances (GRID does not expose individual `money` fields)
- Exact ability purchases per player
- Detailed buy composition (weapons per player)
- Timeout/pause timestamps

---

## Economy & Pause Intelligence (v1.1)

**Source files:**
- `src/domain/econModelConfig.ts` - Configuration constants
- `src/domain/roundAdapter.ts` - Data normalization
- `src/domain/econInference.ts` - Markov state machine
- `src/domain/pauseModel.ts` - Pause recommendations
- `src/domain/tacticalProxy.ts` - Duration-based analysis
- `src/ui/components/EconIntelSection.tsx` - UI rendering

### Economy State Definitions

Economy states represent the inferred financial health of a team. **Status: Implemented**

| State | Description | Typical Scenario |
|-------|-------------|------------------|
| `BROKE` | Unable to buy; forced eco | 2+ consecutive losses |
| `LOW` | Limited funds; partial buy possible | Single loss after win, or recovering |
| `OK` | Adequate funds; can half-buy or full-buy | Breaking even or slight advantage |
| `RICH` | Full funds; comfortable full-buy | 2+ consecutive wins |

**Configuration** (`econModelConfig.ts:14-23`):
```typescript
LOSS_STREAK_BROKE_THRESHOLD = 2   // Consecutive losses to reach BROKE
WIN_STREAK_RICH_THRESHOLD = 2      // Consecutive wins to reach RICH
```

### Buy Classification

Buy classes are mapped directly from economy states. **Status: Implemented**

| Buy Class | When Applied | Economy States |
|-----------|--------------|----------------|
| `ECO` | Saving credits | BROKE |
| `HALF_BUY` | Partial loadout | LOW |
| `FULL_BUY` | Full weapons + utility | OK, RICH |

**Mapping** (`econModelConfig.ts:53-58`):
```typescript
ECON_TO_BUY: Record<EconState, BuyClass> = {
  BROKE: 'ECO',
  LOW: 'HALF_BUY',
  OK: 'FULL_BUY',
  RICH: 'FULL_BUY',
}
```

### Economy Inference Algorithm

The economy inference uses a **Markov-style state machine** that transitions based on round outcomes and survivor counts. **Status: Implemented**

**File:** `src/domain/econInference.ts`

**Entry Point:** `inferMapEconomy(rounds: RoundObs[], teamId: string): MapEconSummary`

#### State Transition Matrix

The base transition probabilities (`econModelConfig.ts:26-50`):

```
              | BROKE | LOW  | OK   | RICH |
--------------+-------+------+------+------+
BROKE → Win   | 0.10  | 0.60 | 0.25 | 0.05 |
BROKE → Loss  | 0.85  | 0.10 | 0.05 | 0.00 |
LOW → Win     | 0.00  | 0.15 | 0.60 | 0.25 |
LOW → Loss    | 0.40  | 0.50 | 0.10 | 0.00 |
OK → Win      | 0.00  | 0.05 | 0.45 | 0.50 |
OK → Loss     | 0.15  | 0.55 | 0.25 | 0.05 |
RICH → Win    | 0.00  | 0.00 | 0.20 | 0.80 |
RICH → Loss   | 0.05  | 0.35 | 0.45 | 0.15 |
```

#### Algorithm Steps

1. **Initialize**: At round 1 and round 13 (half starts), state resets to `OK` with 100% confidence.

2. **For each round**:
   ```typescript
   // Get base transition from current state + outcome (win/loss)
   const transitionKey = won ? 'WIN' : 'LOSS';
   const baseProbs = ECON_TRANSITIONS[currentState][transitionKey];
   ```

3. **Survivor Bonus**: If survivors > 2, apply +15% confidence to RICH/OK states:
   ```typescript
   if (survivorCount > 2) {
     const bonus = SURVIVOR_RICH_BONUS; // 0.15
     probs['RICH'] += bonus;
     probs['OK'] += bonus / 2;
     // Renormalize to sum to 1.0
   }
   ```

4. **Loss Streak Check**: 2+ consecutive losses forces BROKE:
   ```typescript
   if (lossStreak >= LOSS_STREAK_BROKE_THRESHOLD) {
     probs = { BROKE: 0.95, LOW: 0.05, OK: 0, RICH: 0 };
   }
   ```

5. **Win Streak Check**: 2+ consecutive wins elevates to RICH:
   ```typescript
   if (winStreak >= WIN_STREAK_RICH_THRESHOLD) {
     probs['RICH'] += 0.30;
     // Renormalize
   }
   ```

6. **Select State**: Pick state with highest probability; track confidence as that probability.

#### Output Per Round

```typescript
interface EconOut {
  roundIndex: number;
  state: EconState;        // 'BROKE' | 'LOW' | 'OK' | 'RICH'
  confidence: number;      // 0.0 - 1.0
  buyClass: BuyClass;      // Mapped from state
  won: boolean;
  lossStreak: number;
  winStreak: number;
}
```

### Pause Value Model

The pause model calculates a **0-100 score** indicating when a tactical timeout would be most valuable. **Status: Implemented (Heuristic)**

**File:** `src/domain/pauseModel.ts`

**Entry Point:** `analyzeMapPauses(rounds: RoundObs[], teamId: string, econSummary: MapEconSummary): PauseAnalysis`

#### Score Components

| Component | Weight | What It Measures |
|-----------|--------|------------------|
| Momentum | 35% | Opponent's recent win rate + streak |
| Leverage | 30% | How close the round is to map point |
| Econ Risk | 25% | Financial pressure (broke + loss streak) |
| Side Swap | 10% | Proximity to half transition |

**Weights** (`econModelConfig.ts:61-66`):
```typescript
PAUSE_MOMENTUM_WEIGHT = 0.35
PAUSE_LEVERAGE_WEIGHT = 0.30
PAUSE_ECON_RISK_WEIGHT = 0.25
PAUSE_SIDE_SWAP_WEIGHT = 0.10
```

#### Component Calculations

**Momentum** (`pauseModel.ts:45-65`):
```typescript
// Look at last 5 rounds
const lookback = Math.min(5, roundIndex);
const recentRounds = rounds.slice(roundIndex - lookback, roundIndex);
const opponentWins = recentRounds.filter(r => r.winnerTeamId !== teamId).length;
const opponentWinRate = opponentWins / lookback;

// Streak multiplier: consecutive opponent wins
let opponentStreak = 0;
for (let i = roundIndex - 1; i >= 0; i--) {
  if (rounds[i].winnerTeamId !== teamId) opponentStreak++;
  else break;
}
const streakMultiplier = Math.min(opponentStreak * 0.15, 0.45);

momentumScore = (opponentWinRate + streakMultiplier) * 100;
```

**Leverage** (`pauseModel.ts:67-80`):
```typescript
// How close to map point (round 13 = match point potential)
const roundsToWin = 13;
const teamScore = /* wins so far */;
const opponentScore = /* opponent wins */;
const maxScore = Math.max(teamScore, opponentScore);

// Higher leverage near match point
leverageScore = (maxScore / roundsToWin) * 100;
```

**Econ Risk** (`pauseModel.ts:82-95`):
```typescript
const econState = econSummary.rounds[roundIndex]?.state;
const baseRisk = econState === 'BROKE' ? 80 : econState === 'LOW' ? 50 : 20;
const lossStreakBonus = lossStreak * 10;
econRiskScore = Math.min(baseRisk + lossStreakBonus, 100);
```

**Side Swap** (`pauseModel.ts:97-105`):
```typescript
// Rounds 11-13 are near half transition
const distanceToHalf = Math.abs(roundIndex - 12);
sideSwapScore = distanceToHalf <= 2 ? (3 - distanceToHalf) * 33 : 0;
```

#### Final Score

```typescript
pauseScore = (
  momentumScore * PAUSE_MOMENTUM_WEIGHT +
  leverageScore * PAUSE_LEVERAGE_WEIGHT +
  econRiskScore * PAUSE_ECON_RISK_WEIGHT +
  sideSwapScore * PAUSE_SIDE_SWAP_WEIGHT
);
```

#### Recommendations

Rounds with `pauseScore >= 40` are included in recommendations, sorted by score descending. Top 3 are returned.

```typescript
interface PauseRecommendation {
  roundIndex: number;
  score: number;           // 0-100
  reasons: string[];       // Human-readable explanations
}
```

### Tactical Proxies

Tactical proxies infer playstyle tendencies from round duration. **Status: Implemented (Heuristic)**

**File:** `src/domain/tacticalProxy.ts`

**Thresholds** (`econModelConfig.ts:69-70`):
```typescript
FAST_ROUND_THRESHOLD = 60   // seconds
SLOW_ROUND_THRESHOLD = 90   // seconds
```

#### Calculated Metrics

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| `fastWinPct` | Wins where duration < 60s / total rounds | Aggressive execution success |
| `slowWinPct` | Wins where duration > 90s / total rounds | Methodical/late-round success |
| `retakeProxyPct` | Defense wins where duration > 90s | Suggests retake capability |
| `explodeProxyPct` | Attack wins where duration < 60s | Suggests fast site executes |

**Entry Point:** `calculateTacticalProxies(rounds: RoundObs[], teamId: string): TacticalProxies`

```typescript
interface TacticalProxies {
  fastRoundsTotal: number;
  fastWinPct: number;
  slowRoundsTotal: number;
  slowWinPct: number;
  retakeProxyPct: number;   // Heuristic: slow defense wins
  explodeProxyPct: number;  // Heuristic: fast attack wins
}
```

### Output Structures

**Map Economy Summary** (`econInference.ts`):
```typescript
interface MapEconSummary {
  mapName: string;
  rounds: EconOut[];
  econDistribution: Record<EconState, number>;  // Percentage per state
  buyDistribution: Record<BuyClass, number>;    // Percentage per class
  avgConfidence: number;
}
```

**Pause Analysis** (`pauseModel.ts`):
```typescript
interface PauseAnalysis {
  mapName: string;
  recommendations: PauseRecommendation[];
  avgPauseScore: number;
}
```

---

## Round Outcome & Momentum (v1.0)

**Source files:**
- `src/analysis/roundOutcome.ts` - All momentum analysis

### Round Type Definitions

**Status: Implemented**

| Round Type | Round Numbers | Description |
|------------|---------------|-------------|
| `pistol` | 1, 13 | Economy reset; pistols + abilities only |
| `post-pistol` | 2, 14 | Round after pistol; often eco vs bonus |
| `gun` | All others | Standard buy rounds |

**Constants** (`roundOutcome.ts:177-179`):
```typescript
const PISTOL_ROUNDS = [1, 13];
const POST_PISTOL_ROUNDS = [2, 14];
```

> **Note:** The original spec mentioned R12 for second pistol, but standard Valorant has 12 rounds per half, making R13 the correct second pistol round. The implementation uses R1/R13.

### Side Performance

**Status: Implemented**

Tracks win rates by side (Attack/Defense) per map.

**Function:** `computeSidePerformance(timelines, teamId): SidePerformance[]`

```typescript
interface SidePerformance {
  map: string;
  attackRoundsPlayed: number;
  attackRoundsWon: number;
  attackWinRate: number;          // attackRoundsWon / attackRoundsPlayed
  defenseRoundsPlayed: number;
  defenseRoundsWon: number;
  defenseWinRate: number;
  strongerSide: 'Attack' | 'Defense' | 'Even';  // >5% difference
}
```

### Pistol Analysis

**Status: Implemented**

#### Pistol Performance

**Function:** `computePistolPerformance(timelines, teamId): PistolPerformance[]`

Tracks:
- Overall pistol win rate
- Pistol win rate by side (Attack/Defense)
- Map win rate conditioned on pistol outcome

```typescript
interface PistolPerformance {
  map: string;
  pistolRoundsPlayed: number;
  pistolRoundsWon: number;
  pistolWinRate: number;
  attackPistolWinRate: number;
  defensePistolWinRate: number;
  mapWinRateGivenPistolWin: number;    // P(map win | pistol win)
  mapWinRateGivenPistolLoss: number;   // P(map win | pistol loss)
}
```

#### Post-Pistol Performance

**Function:** `computePostPistolPerformance(timelines, teamId): PostPistolPerformance[]`

Tracks conditional chains after pistol:

```typescript
interface PostPistolPerformance {
  map: string;
  postPistolWinRate: number;
  postPistolWinRateAfterPistolWin: number;   // P(post-pistol win | pistol win)
  forceBreakRate: number;                     // P(post-pistol win | pistol loss)
}
```

The **force break rate** indicates how often a team can win the post-pistol round despite losing pistol (i.e., breaking the opponent's eco advantage).

### Streak Analysis

**Status: Implemented**

#### Streak Statistics

**Function:** `computeStreakStats(timelines, teamId): StreakStats[]`

```typescript
interface StreakStats {
  map: string;
  maxStreak: number;
  avgStreakLength: number;
  twoRoundStreaks: number;
  threeRoundStreaks: number;
  fourPlusStreaks: number;
  totalStreaks: number;
}
```

#### Streak Continuation Probability

**Function:** `computeStreakContinuation(timelines, teamId): StreakContinuation[]`

Calculates the probability of winning the next round given a current streak:

```typescript
interface StreakContinuation {
  map: string;
  winAfter1Win: number;         // P(win | 1 consecutive win)
  winAfter1WinSamples: number;
  winAfter2Wins: number;        // P(win | 2 consecutive wins)
  winAfter2WinsSamples: number;
  winAfter3Wins: number;        // P(win | 3+ consecutive wins)
  winAfter3WinsSamples: number;
}
```

### Heat Zones

**Status: Implemented**

Heat zones divide the map into round ranges to identify where teams perform best/worst.

**Zones** (`roundOutcome.ts:186-193`):
```typescript
const HEAT_ZONES = [
  { label: 'Early (1-4)', start: 1, end: 4 },
  { label: 'Mid-First (5-8)', start: 5, end: 8 },
  { label: 'Late-First (9-12)', start: 9, end: 12 },
  { label: 'Early-Second (13-16)', start: 13, end: 16 },
  { label: 'Mid-Second (17-20)', start: 17, end: 20 },
  { label: 'Late-Second (21-24)', start: 21, end: 24 },
];
```

**Function:** `computeHeatZones(timelines, teamId): HeatZone[]`

```typescript
interface HeatZone {
  roundRange: string;
  startRound: number;
  endRound: number;
  winRate: number;
  streakStartRate: number;   // % of all streak starts in this zone
  streakEndRate: number;     // % of all streak ends in this zone
  significance: 'high' | 'medium' | 'low';  // Based on deviation from avg
}
```

**Significance Calculation:**
- `high`: Win rate differs from average by >15%
- `low`: Win rate differs from average by <5%
- `medium`: Everything else

### Conditional Signals

**Status: Implemented**

**Function:** `computeConditionalSignals(timelines, teamId): MapConditionalSignals[]`

```typescript
interface MapConditionalSignals {
  map: string;
  mapWinRateGivenPistolWin: number;      // P(map win | any pistol win)
  mapWinRateGivenPostPistolWin: number;  // P(map win | any post-pistol win)
  mapWinRateGivenEarlyStreak: number;    // P(map win | 3+ streak in R1-5)
  samples: {
    pistolWins: number;
    postPistolWins: number;
    earlyStreaks: number;
  };
}
```

**Early Streak Definition:** 3+ consecutive wins within the first 5 rounds.

---

## Limitations

### Data Limitations

1. **No Per-Player Economy**: GRID does not expose individual player credits. Economy inference is team-level approximation.

2. **Duration May Be Missing**: Some matches lack `round.duration`, making tactical proxies unavailable.

3. **Survivor Count Inference**: We estimate survivors from kill counts, not actual post-round state.

4. **No Pause Timestamps**: Actual timeout usage is not available; the pause model provides recommendations, not historical analysis.

### Model Limitations

1. **Economy Inference is Heuristic**: The Markov model uses probabilistic transitions that may not reflect actual Valorant economy rules precisely. Confidence scores indicate certainty.

2. **Small Sample Sizes**: Conditional signals (e.g., "map win rate given early streak") may have few samples, making rates unreliable.

3. **Map-Specific Variance**: All analysis is per-map, but map pools change over time. Historical data may not reflect current form.

4. **No Agent Composition Consideration**: Economy and momentum analysis do not factor in agent picks or compositions.

---

## Developer Notes

### File Organization

```
src/
├── domain/
│   ├── econModelConfig.ts    # All thresholds and weights
│   ├── roundAdapter.ts       # RoundObs normalization
│   ├── econInference.ts      # Markov state machine
│   ├── pauseModel.ts         # Pause recommendations
│   └── tacticalProxy.ts      # Duration-based analysis
├── analysis/
│   ├── roundOutcome.ts       # v1.0 momentum model
│   └── reports/
│       └── overviewReport.ts # Integration point
└── ui/
    └── components/
        ├── MomentumSection.tsx   # v1.0 UI
        └── EconIntelSection.tsx  # v1.1 UI
```

### Key Functions

| Function | File | Purpose |
|----------|------|---------|
| `mapToRoundObs()` | roundAdapter.ts | Convert GRID Round to RoundObs |
| `inferMapEconomy()` | econInference.ts | Run Markov inference on map |
| `analyzeMapPauses()` | pauseModel.ts | Generate pause recommendations |
| `calculateTacticalProxies()` | tacticalProxy.ts | Compute duration-based stats |
| `buildRoundOutcomeReport()` | roundOutcome.ts | Generate full momentum report |
| `buildEconIntelData()` | overviewReport.ts | Aggregate econ intel for report |

### Testing New Thresholds

All configurable values are in `econModelConfig.ts`. To tune:

1. Adjust thresholds (e.g., `LOSS_STREAK_BROKE_THRESHOLD`)
2. Modify transition probabilities in `ECON_TRANSITIONS`
3. Change pause weights (must sum to 1.0)
4. Rebuild and test with `/overview` command

### Adding New Metrics

1. Add type to `roundOutcome.ts` or create new domain file
2. Implement computation function following existing patterns
3. Export from appropriate index
4. Add to report builder (`overviewReport.ts`)
5. Create UI component if needed
6. Update this documentation

---

*Last updated: 2026-01-29*
*Version: 1.1*
