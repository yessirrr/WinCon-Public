/**
 * Tactical Proxy Logic - Duration-based tactical tendencies
 *
 * PROXY DATA - No ability data, uses round duration as tactical indicator.
 */

import type { RoundObs } from './roundAdapter.js';
import {
  FAST_ROUND_THRESHOLD_SEC,
  SLOW_ROUND_THRESHOLD_SEC,
  MIN_ROUNDS_FOR_TACTICAL_STATS,
} from './econModelConfig.js';

// ============================================================================
// Types
// ============================================================================

export interface TacticalProxies {
  mapName: string;
  teamId: string;
  hasDurationData: boolean;

  // Core metrics (null if no duration data)
  fastWinPct: number | null;      // % of wins that were fast rounds
  slowWinPct: number | null;      // % of wins that were slow rounds
  retakeProxyPct: number | null;  // Defense wins with long duration
  explodeProxyPct: number | null; // Attack wins with short duration

  // Sample sizes
  totalWins: number;
  totalAttackWins: number;
  totalDefenseWins: number;
  winsWithDuration: number;

  // Notes
  notes: string;
}

// ============================================================================
// Helpers
// ============================================================================

function classifyDuration(durationSec: number): 'fast' | 'normal' | 'slow' {
  if (durationSec <= FAST_ROUND_THRESHOLD_SEC) return 'fast';
  if (durationSec >= SLOW_ROUND_THRESHOLD_SEC) return 'slow';
  return 'normal';
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Calculate tactical proxy metrics for a team on a map
 */
export function calculateTacticalProxies(
  rounds: RoundObs[],
  teamId: string
): TacticalProxies {
  const mapName = rounds[0]?.mapName ?? 'Unknown';

  // Filter to team wins
  const wins = rounds.filter(r => r.winnerTeamId === teamId);
  const attackWins = wins.filter(r => r.attackTeamId === teamId);
  const defenseWins = wins.filter(r => r.defenseTeamId === teamId);

  // Check for duration data
  const winsWithDuration = wins.filter(r => r.durationSec !== undefined);
  const hasDurationData = winsWithDuration.length >= MIN_ROUNDS_FOR_TACTICAL_STATS;

  if (!hasDurationData) {
    return {
      mapName,
      teamId,
      hasDurationData: false,
      fastWinPct: null,
      slowWinPct: null,
      retakeProxyPct: null,
      explodeProxyPct: null,
      totalWins: wins.length,
      totalAttackWins: attackWins.length,
      totalDefenseWins: defenseWins.length,
      winsWithDuration: winsWithDuration.length,
      notes: 'Insufficient duration data (N/A)',
    };
  }

  // Classify wins by duration
  let fastWins = 0;
  let slowWins = 0;

  for (const round of winsWithDuration) {
    const durClass = classifyDuration(round.durationSec!);
    if (durClass === 'fast') fastWins++;
    else if (durClass === 'slow') slowWins++;
  }

  // Attack wins with short duration (explode success)
  const attackWinsWithDuration = attackWins.filter(r => r.durationSec !== undefined);
  const explodeWins = attackWinsWithDuration.filter(
    r => classifyDuration(r.durationSec!) === 'fast'
  ).length;

  // Defense wins with long duration (retake comfort)
  const defenseWinsWithDuration = defenseWins.filter(r => r.durationSec !== undefined);
  const retakeWins = defenseWinsWithDuration.filter(
    r => classifyDuration(r.durationSec!) === 'slow'
  ).length;

  // Calculate percentages
  const total = winsWithDuration.length;
  const fastWinPct = (fastWins / total) * 100;
  const slowWinPct = (slowWins / total) * 100;

  const retakeProxyPct = defenseWinsWithDuration.length > 0
    ? (retakeWins / defenseWinsWithDuration.length) * 100
    : 0;

  const explodeProxyPct = attackWinsWithDuration.length > 0
    ? (explodeWins / attackWinsWithDuration.length) * 100
    : 0;

  // Build notes
  const notes: string[] = [];
  if (fastWinPct > 40) notes.push('Fast-round tendency');
  if (slowWinPct > 40) notes.push('Slow-round tendency');
  if (retakeProxyPct > 50) notes.push('Retake comfort');
  if (explodeProxyPct > 50) notes.push('Explode success');

  return {
    mapName,
    teamId,
    hasDurationData: true,
    fastWinPct,
    slowWinPct,
    retakeProxyPct,
    explodeProxyPct,
    totalWins: wins.length,
    totalAttackWins: attackWins.length,
    totalDefenseWins: defenseWins.length,
    winsWithDuration: winsWithDuration.length,
    notes: notes.length > 0 ? notes.join(', ') : 'No strong tendencies',
  };
}

/**
 * Get a summary label for tactical style
 */
export function getTacticalStyleLabel(proxies: TacticalProxies): string {
  if (!proxies.hasDurationData) return 'N/A';

  const fast = proxies.fastWinPct ?? 0;
  const slow = proxies.slowWinPct ?? 0;

  if (fast > 50) return 'Aggressive/Fast';
  if (slow > 50) return 'Methodical/Slow';
  if (fast > 35 && slow > 35) return 'Adaptable';
  return 'Balanced';
}
