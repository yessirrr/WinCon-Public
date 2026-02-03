/**
 * Economy Inference - Markov-style hidden economy state + buy classification
 *
 * INFERRED DATA - Does not use actual credits, only observable outcomes.
 */
import type { RoundObs } from './roundAdapter.js';
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
    econDistribution: Record<EconState, number>;
    buyDistribution: Record<BuyClass, number>;
    avgConfidence: number;
}
/**
 * Run economy inference for a team across all rounds in a map
 */
export declare function inferMapEconomy(rounds: RoundObs[], teamId: string): MapEconSummary;
/**
 * Get economy state at a specific round boundary (for pause model)
 */
export declare function getEconAtRound(summary: MapEconSummary, roundIndex: number): EconOut | null;
