import React from 'react';
import type { MapEconSummary, BuyClass, EconState } from '../../domain/econInference.js';
import type { MapPauseAnalysis } from '../../domain/pauseModel.js';
export interface EconIntelData {
    mapSummaries: Array<{
        mapName: string;
        econ: MapEconSummary;
        pause: MapPauseAnalysis;
        sideWinRates: {
            attack: number;
            defense: number;
            attackRounds: number;
            defenseRounds: number;
        };
        roundTypeWinRates: {
            pistol: number;
            pistolPlayed: number;
            postPistol: number;
            postPistolPlayed: number;
        };
    }>;
    aggregated: {
        avgEconConfidence: number;
        econDistribution: Record<EconState, number>;
        buyDistribution: Record<BuyClass, number>;
    };
}
interface EconIntelSectionProps {
    data: EconIntelData;
}
export declare function EconIntelSection({ data }: EconIntelSectionProps): React.ReactElement;
export {};
