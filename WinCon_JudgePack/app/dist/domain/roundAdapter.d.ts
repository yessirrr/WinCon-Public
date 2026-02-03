/**
 * Round Adapter - Normalizes GRID round data into RoundObs for economy/tactical models
 */
import type { Round, MapResult } from '../data/models/index.js';
export type HalfTag = 'H1' | 'H2' | 'OT';
export interface RoundObs {
    roundIndex: number;
    halfTag: HalfTag;
    mapName: string;
    attackTeamId: string;
    defenseTeamId: string;
    winnerTeamId: string;
    loserTeamId: string;
    winnerSide: 'attack' | 'defense';
    durationSec?: number;
    attackDeaths?: number;
    defenseDeaths?: number;
    attackSurvivors?: number;
    defenseSurvivors?: number;
}
/**
 * Convert a single Round to RoundObs
 */
export declare function roundToObs(round: Round, mapName: string): RoundObs | null;
/**
 * Convert all rounds in a map to RoundObs array
 */
export declare function mapToRoundObs(map: MapResult): RoundObs[];
/**
 * Check if round is a pistol round (R1 or R12 per spec)
 */
export declare function isPistolRound(roundIndex: number): boolean;
/**
 * Check if round is a post-pistol round (R2 or R13 per spec)
 */
export declare function isPostPistolRound(roundIndex: number): boolean;
/**
 * Check if round is start of a half (for economy reset)
 */
export declare function isHalfStart(roundIndex: number): boolean;
