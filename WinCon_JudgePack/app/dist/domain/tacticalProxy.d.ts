/**
 * Tactical Proxy Logic - Duration-based tactical tendencies
 *
 * PROXY DATA - No ability data, uses round duration as tactical indicator.
 */
import type { RoundObs } from './roundAdapter.js';
export interface TacticalProxies {
    mapName: string;
    teamId: string;
    hasDurationData: boolean;
    fastWinPct: number | null;
    slowWinPct: number | null;
    retakeProxyPct: number | null;
    explodeProxyPct: number | null;
    totalWins: number;
    totalAttackWins: number;
    totalDefenseWins: number;
    winsWithDuration: number;
    notes: string;
}
/**
 * Calculate tactical proxy metrics for a team on a map
 */
export declare function calculateTacticalProxies(rounds: RoundObs[], teamId: string): TacticalProxies;
/**
 * Get a summary label for tactical style
 */
export declare function getTacticalStyleLabel(proxies: TacticalProxies): string;
