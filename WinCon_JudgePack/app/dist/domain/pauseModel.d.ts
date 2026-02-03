/**
 * Pause Value Model - Recommends optimal pause windows based on momentum and economy
 *
 * DECISION SUPPORT ONLY - Not predictive, uses inferred/proxy data.
 */
import type { RoundObs } from './roundAdapter.js';
import type { MapEconSummary } from './econInference.js';
export interface PauseOut {
    pauseScore: number;
    reason: string;
}
export interface PauseWindow {
    beforeRound: number;
    score: number;
    scoreContext: string;
    pauseScore: number;
    reason: string;
}
export interface MapPauseAnalysis {
    mapName: string;
    teamId: string;
    windows: PauseWindow[];
    topRecommendations: PauseWindow[];
}
/**
 * Calculate pause score for a specific round boundary
 */
export declare function calculatePauseScore(rounds: RoundObs[], teamId: string, beforeRound: number, econSummary: MapEconSummary | null): PauseOut;
/**
 * Analyze all pause windows for a map and return top recommendations
 */
export declare function analyzeMapPauses(rounds: RoundObs[], teamId: string, econSummary: MapEconSummary | null): MapPauseAnalysis;
