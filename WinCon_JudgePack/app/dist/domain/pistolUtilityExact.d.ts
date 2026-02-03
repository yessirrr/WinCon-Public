import type { Match, ReportFilters, UtilityExactAbilityPurchase, PistolUtilityExactReportData, PistolLoadoutReportData } from '../data/models/index.js';
type ItemRef = {
    uuid?: string | null;
    name?: string | null;
} | string | null | undefined;
interface InferenceResult {
    status: 'EXACT' | 'AMBIGUOUS' | 'NO_SOLUTION';
    abilityBudget: number | null;
    abilitySpend: number | null;
    weaponCost: number | null;
    armorCost: number | null;
    weaponName: string | null;
    armorName: string | null;
    abilities: UtilityExactAbilityPurchase[] | null;
    solutionCount?: number;
    sampleSolutions?: string[];
    reason?: string;
}
export declare function inferAbilityPurchasesExact(input: {
    agentName: string;
    moneyRemaining: number | null;
    weapon?: ItemRef;
    armor?: ItemRef;
    allowFallback?: boolean;
}): InferenceResult;
export declare function buildPistolUtilityExactData(entityType: 'team' | 'player', entityId: string, matches: Match[], filters: ReportFilters): Promise<PistolUtilityExactReportData>;
export declare function buildPistolLoadoutData(entityType: 'team' | 'player', entityId: string, matches: Match[], filters: ReportFilters): PistolLoadoutReportData;
export {};
