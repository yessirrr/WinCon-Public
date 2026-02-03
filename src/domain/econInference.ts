/**
 * Economy Inference - Markov-style hidden economy state + buy classification
 *
 * INFERRED DATA - Does not use actual credits, only observable outcomes.
 */

import type { RoundObs } from './roundAdapter.js';
import { isPistolRound, isPostPistolRound, isHalfStart } from './roundAdapter.js';
import {
  ECON_TRANSITIONS,
  ECON_TO_BUY,
  LOSS_STREAK_BROKE_THRESHOLD,
  WIN_STREAK_RICH_THRESHOLD,
  SURVIVAL_ECON_BONUS,
  BASE_BUY_CONFIDENCE,
  STRONG_SIGNAL_CONFIDENCE_BOOST,
  UNCERTAIN_CONFIDENCE_PENALTY,
} from './econModelConfig.js';

// ============================================================================
// Types
// ============================================================================

export type EconState = 'BROKE' | 'LOW' | 'OK' | 'RICH';
export type BuyClass = 'ECO' | 'HALF_BUY' | 'FULL_BUY';

export interface EconOut {
  econState: EconState;
  confidence: number;
  notes: string;
}

export interface BuyClassOut {
  buyClass: BuyClass;
  confidence: number;
  notes: string;
}

export interface TeamRoundEcon {
  roundIndex: number;
  teamId: string;
  econ: EconOut;
  buy: BuyClassOut;
}

export interface MapEconSummary {
  mapName: string;
  teamId: string;
  rounds: TeamRoundEcon[];
  // Aggregated stats
  econDistribution: Record<EconState, number>;
  buyDistribution: Record<BuyClass, number>;
  avgConfidence: number;
}

// ============================================================================
// State Machine
// ============================================================================

interface TeamState {
  econState: EconState;
  lossStreak: number;
  winStreak: number;
  lastSurvivors: number;
}

function initTeamState(): TeamState {
  return {
    econState: 'LOW', // Pistol economy
    lossStreak: 0,
    winStreak: 0,
    lastSurvivors: 0,
  };
}

function updateTeamState(
  state: TeamState,
  won: boolean,
  survivors?: number,
  roundIndex?: number
): TeamState {
  // Reset at half start
  if (roundIndex !== undefined && isHalfStart(roundIndex)) {
    return {
      econState: 'LOW',
      lossStreak: 0,
      winStreak: 0,
      lastSurvivors: 0,
    };
  }

  const newState = { ...state };

  // Update streaks
  if (won) {
    newState.winStreak = state.winStreak + 1;
    newState.lossStreak = 0;
    newState.lastSurvivors = survivors ?? 0;
  } else {
    newState.lossStreak = state.lossStreak + 1;
    newState.winStreak = 0;
    newState.lastSurvivors = survivors ?? 0;
  }

  // Base transition
  const outcome = won ? 'win' : 'loss';
  let nextEcon = ECON_TRANSITIONS[state.econState]?.[outcome] as EconState ?? state.econState;

  // Adjustments based on streaks
  if (newState.lossStreak >= LOSS_STREAK_BROKE_THRESHOLD) {
    // Long loss streak forces BROKE
    nextEcon = 'BROKE';
  } else if (newState.winStreak >= WIN_STREAK_RICH_THRESHOLD) {
    // Win streak pushes toward RICH
    nextEcon = 'RICH';
  }

  // Survival bonus - more survivors = better carryover
  if (won && survivors !== undefined && survivors > 2) {
    const bonus = (survivors - 2) * SURVIVAL_ECON_BONUS;
    if (bonus > 0.3 && nextEcon === 'OK') {
      nextEcon = 'RICH';
    } else if (bonus > 0.15 && nextEcon === 'LOW') {
      nextEcon = 'OK';
    }
  }

  newState.econState = nextEcon;
  return newState;
}

// ============================================================================
// Inference Functions
// ============================================================================

function inferEconState(
  state: TeamState,
  roundIndex: number,
  won: boolean
): EconOut {
  let confidence = BASE_BUY_CONFIDENCE;
  const notes: string[] = [];

  // Pistol rounds are always LOW economy
  if (isPistolRound(roundIndex)) {
    return {
      econState: 'LOW',
      confidence: 0.95,
      notes: 'Pistol round - fixed starting economy',
    };
  }

  // Post-pistol has predictable patterns
  if (isPostPistolRound(roundIndex)) {
    confidence += STRONG_SIGNAL_CONFIDENCE_BOOST;
    notes.push('Post-pistol round');
  }

  // Loss streak is strong signal
  if (state.lossStreak >= LOSS_STREAK_BROKE_THRESHOLD) {
    confidence += STRONG_SIGNAL_CONFIDENCE_BOOST;
    notes.push(`${state.lossStreak} loss streak`);
  }

  // Win streak is strong signal
  if (state.winStreak >= WIN_STREAK_RICH_THRESHOLD) {
    confidence += STRONG_SIGNAL_CONFIDENCE_BOOST * 0.8;
    notes.push(`${state.winStreak} win streak`);
  }

  // Cap confidence
  confidence = Math.min(confidence, 0.95);

  return {
    econState: state.econState,
    confidence,
    notes: notes.length > 0 ? notes.join(', ') : 'Inferred from outcomes',
  };
}

function inferBuyClass(econ: EconOut, roundIndex: number): BuyClassOut {
  // Pistol rounds are always ECO-equivalent (pistol buy)
  if (isPistolRound(roundIndex)) {
    return {
      buyClass: 'ECO',
      confidence: 0.95,
      notes: 'Pistol round',
    };
  }

  const buyClass = ECON_TO_BUY[econ.econState] as BuyClass ?? 'FULL_BUY';
  let confidence = econ.confidence;
  const notes: string[] = [];

  // Post-pistol adjustments
  if (isPostPistolRound(roundIndex)) {
    // Winner likely full buys, loser likely ecos
    notes.push('Post-pistol');
  }

  // Reduce confidence for middle states
  if (econ.econState === 'OK' || econ.econState === 'LOW') {
    confidence -= UNCERTAIN_CONFIDENCE_PENALTY;
    notes.push('Mid-range economy');
  }

  confidence = Math.max(0.3, Math.min(confidence, 0.95));

  return {
    buyClass,
    confidence,
    notes: notes.length > 0 ? notes.join(', ') : `From ${econ.econState} state`,
  };
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Run economy inference for a team across all rounds in a map
 */
export function inferMapEconomy(
  rounds: RoundObs[],
  teamId: string
): MapEconSummary {
  const results: TeamRoundEcon[] = [];
  let state = initTeamState();

  const econDist: Record<EconState, number> = { BROKE: 0, LOW: 0, OK: 0, RICH: 0 };
  const buyDist: Record<BuyClass, number> = { ECO: 0, HALF_BUY: 0, FULL_BUY: 0 };
  let totalConfidence = 0;

  for (const round of rounds) {
    // Reset state at half boundaries
    if (isHalfStart(round.roundIndex)) {
      state = initTeamState();
    }

    // Determine if this team won
    const won = round.winnerTeamId === teamId;
    const isAttack = round.attackTeamId === teamId;
    const survivors = isAttack ? round.attackSurvivors : round.defenseSurvivors;

    // Infer economy state (before the round)
    const econ = inferEconState(state, round.roundIndex, won);
    const buy = inferBuyClass(econ, round.roundIndex);

    results.push({
      roundIndex: round.roundIndex,
      teamId,
      econ,
      buy,
    });

    // Update distributions
    econDist[econ.econState]++;
    buyDist[buy.buyClass]++;
    totalConfidence += econ.confidence;

    // Update state for next round
    state = updateTeamState(state, won, survivors, round.roundIndex + 1);
  }

  // Convert counts to percentages
  const totalRounds = results.length || 1;
  const econDistPct = {
    BROKE: econDist.BROKE / totalRounds,
    LOW: econDist.LOW / totalRounds,
    OK: econDist.OK / totalRounds,
    RICH: econDist.RICH / totalRounds,
  };
  const buyDistPct = {
    ECO: buyDist.ECO / totalRounds,
    HALF_BUY: buyDist.HALF_BUY / totalRounds,
    FULL_BUY: buyDist.FULL_BUY / totalRounds,
  };

  return {
    mapName: rounds[0]?.mapName ?? 'Unknown',
    teamId,
    rounds: results,
    econDistribution: econDistPct,
    buyDistribution: buyDistPct,
    avgConfidence: totalConfidence / totalRounds,
  };
}

/**
 * Get economy state at a specific round boundary (for pause model)
 */
export function getEconAtRound(
  summary: MapEconSummary,
  roundIndex: number
): EconOut | null {
  const roundEcon = summary.rounds.find(r => r.roundIndex === roundIndex);
  return roundEcon?.econ ?? null;
}
