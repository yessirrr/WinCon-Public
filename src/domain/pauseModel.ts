/**
 * Pause Value Model - Recommends optimal pause windows based on momentum and economy
 *
 * DECISION SUPPORT ONLY - Not predictive, uses inferred/proxy data.
 */

import type { RoundObs } from './roundAdapter.js';
import type { MapEconSummary } from './econInference.js';
import { getEconAtRound } from './econInference.js';
import {
  PAUSE_MOMENTUM_WEIGHT,
  PAUSE_LEVERAGE_WEIGHT,
  PAUSE_ECON_RISK_WEIGHT,
  PAUSE_SIDE_SWAP_WEIGHT,
  PAUSE_RECOMMENDATION_THRESHOLD,
  FIRST_HALF_END,
} from './econModelConfig.js';

// ============================================================================
// Types
// ============================================================================

export interface PauseOut {
  pauseScore: number;           // 0..100
  reason: string;
}

export interface PauseWindow {
  beforeRound: number;          // Pause before this round
  score: number;
  scoreContext: string;         // e.g., "5-3"
  pauseScore: number;
  reason: string;
}

export interface MapPauseAnalysis {
  mapName: string;
  teamId: string;
  windows: PauseWindow[];
  topRecommendations: PauseWindow[];
}

// ============================================================================
// Score Tracking
// ============================================================================

interface ScoreState {
  teamScore: number;
  opponentScore: number;
}

function trackScores(rounds: RoundObs[], teamId: string): Map<number, ScoreState> {
  const scores = new Map<number, ScoreState>();
  let teamScore = 0;
  let opponentScore = 0;

  // Initial score before round 1
  scores.set(1, { teamScore: 0, opponentScore: 0 });

  for (const round of rounds) {
    if (round.winnerTeamId === teamId) {
      teamScore++;
    } else {
      opponentScore++;
    }
    // Score after this round = score before next round
    scores.set(round.roundIndex + 1, { teamScore, opponentScore });
  }

  return scores;
}

// ============================================================================
// Momentum Calculation
// ============================================================================

function calculateOpponentMomentum(
  rounds: RoundObs[],
  teamId: string,
  beforeRound: number
): number {
  // Look at last 3-5 rounds
  const recentRounds = rounds
    .filter(r => r.roundIndex < beforeRound && r.roundIndex >= beforeRound - 5)
    .sort((a, b) => b.roundIndex - a.roundIndex);

  if (recentRounds.length === 0) return 0;

  // Count opponent wins in recent rounds
  let opponentWins = 0;
  let streak = 0;
  let maxStreak = 0;

  for (const round of recentRounds) {
    if (round.winnerTeamId !== teamId) {
      opponentWins++;
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 0;
    }
  }

  // Momentum score: combination of win rate and streak
  const winRate = opponentWins / recentRounds.length;
  const streakBonus = Math.min(maxStreak / 3, 1); // Cap at 3-round streak

  return (winRate * 0.6 + streakBonus * 0.4) * 100;
}

// ============================================================================
// Leverage Calculation
// ============================================================================

function calculateLeverage(
  scores: ScoreState,
  roundIndex: number
): number {
  const { teamScore, opponentScore } = scores;
  const totalRounds = teamScore + opponentScore;
  let leverage = 0;

  // Close score (within 2 rounds)
  const scoreDiff = Math.abs(teamScore - opponentScore);
  if (scoreDiff <= 2) {
    leverage += 30;
  } else if (scoreDiff <= 4) {
    leverage += 15;
  }

  // Late game (after round 20)
  if (totalRounds >= 20) {
    leverage += 25;
  } else if (totalRounds >= 15) {
    leverage += 15;
  }

  // Near match point
  if (teamScore >= 11 || opponentScore >= 11) {
    leverage += 30;
  }

  // Trailing (need to catch up)
  if (opponentScore > teamScore) {
    leverage += (opponentScore - teamScore) * 5;
  }

  return Math.min(leverage, 100);
}

// ============================================================================
// Economy Risk Calculation
// ============================================================================

function calculateEconRisk(
  econSummary: MapEconSummary | null,
  roundIndex: number
): number {
  if (!econSummary) return 30; // Default moderate risk

  const econ = getEconAtRound(econSummary, roundIndex);
  if (!econ) return 30;

  // Risk based on economy state
  switch (econ.econState) {
    case 'BROKE':
      return 90;
    case 'LOW':
      return 60;
    case 'OK':
      return 30;
    case 'RICH':
      return 10;
    default:
      return 30;
  }
}

// ============================================================================
// Side Swap Value
// ============================================================================

function calculateSideSwapValue(roundIndex: number): number {
  // High value just before side swap (round 12->13)
  if (roundIndex === FIRST_HALF_END + 1) {
    return 80;
  }
  // Some value near side swap
  if (roundIndex >= FIRST_HALF_END - 1 && roundIndex <= FIRST_HALF_END + 2) {
    return 40;
  }
  return 0;
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Calculate pause score for a specific round boundary
 */
export function calculatePauseScore(
  rounds: RoundObs[],
  teamId: string,
  beforeRound: number,
  econSummary: MapEconSummary | null
): PauseOut {
  const scores = trackScores(rounds, teamId);
  const scoreState = scores.get(beforeRound) ?? { teamScore: 0, opponentScore: 0 };

  // Component scores (0-100 each)
  const momentum = calculateOpponentMomentum(rounds, teamId, beforeRound);
  const leverage = calculateLeverage(scoreState, beforeRound);
  const econRisk = calculateEconRisk(econSummary, beforeRound);
  const sideSwap = calculateSideSwapValue(beforeRound);

  // Weighted combination
  const pauseScore = Math.round(
    (momentum * PAUSE_MOMENTUM_WEIGHT +
     leverage * PAUSE_LEVERAGE_WEIGHT +
     econRisk * PAUSE_ECON_RISK_WEIGHT +
     sideSwap * PAUSE_SIDE_SWAP_WEIGHT) / 100
  );

  // Build reason
  const reasons: string[] = [];
  if (momentum >= 50) reasons.push(`Opponent momentum (${Math.round(momentum)})`);
  if (leverage >= 50) reasons.push(`High leverage (${Math.round(leverage)})`);
  if (econRisk >= 60) reasons.push(`Economy risk (${Math.round(econRisk)})`);
  if (sideSwap >= 40) reasons.push('Near side swap');

  return {
    pauseScore: Math.min(pauseScore, 100),
    reason: reasons.length > 0 ? reasons.join('; ') : 'Low pause value',
  };
}

/**
 * Analyze all pause windows for a map and return top recommendations
 */
export function analyzeMapPauses(
  rounds: RoundObs[],
  teamId: string,
  econSummary: MapEconSummary | null
): MapPauseAnalysis {
  const scores = trackScores(rounds, teamId);
  const windows: PauseWindow[] = [];

  // Analyze each round boundary
  for (let r = 2; r <= rounds.length + 1; r++) {
    const scoreState = scores.get(r) ?? { teamScore: 0, opponentScore: 0 };
    const pause = calculatePauseScore(rounds, teamId, r, econSummary);

    windows.push({
      beforeRound: r,
      score: r - 1, // Total rounds played
      scoreContext: `${scoreState.teamScore}-${scoreState.opponentScore}`,
      pauseScore: pause.pauseScore,
      reason: pause.reason,
    });
  }

  // Get top 3 recommendations above threshold
  const topRecommendations = windows
    .filter(w => w.pauseScore >= PAUSE_RECOMMENDATION_THRESHOLD)
    .sort((a, b) => b.pauseScore - a.pauseScore)
    .slice(0, 3);

  return {
    mapName: rounds[0]?.mapName ?? 'Unknown',
    teamId,
    windows,
    topRecommendations,
  };
}
