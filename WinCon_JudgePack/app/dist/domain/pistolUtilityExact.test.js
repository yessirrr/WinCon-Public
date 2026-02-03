import { describe, expect, it } from 'vitest';
import { inferAbilityPurchasesExact } from './pistolUtilityExact.js';
function normalizeAbilities(result) {
    if (!result.abilities)
        return [];
    return result.abilities
        .map((ability) => `${ability.name} x${ability.charges}`)
        .sort();
}
describe('inferAbilityPurchasesExact', () => {
    it('returns EXACT for Omen budget 300 (Dark Cover x2)', () => {
        const result = inferAbilityPurchasesExact({
            agentName: 'Omen',
            moneyRemaining: 500,
            weapon: 'Classic',
            armor: null,
        });
        expect(result.status).toBe('EXACT');
        expect(normalizeAbilities(result)).toEqual(['Dark Cover x2']);
    });
    it('returns EXACT for Omen budget 450 (Paranoia + Shrouded Step x2)', () => {
        const result = inferAbilityPurchasesExact({
            agentName: 'Omen',
            moneyRemaining: 350,
            weapon: 'Classic',
            armor: null,
        });
        expect(result.status).toBe('EXACT');
        expect(normalizeAbilities(result)).toEqual(['Paranoia x1', 'Shrouded Step x2']);
    });
    it('returns AMBIGUOUS for Omen budget 350', () => {
        const result = inferAbilityPurchasesExact({
            agentName: 'Omen',
            moneyRemaining: 450,
            weapon: 'Classic',
            armor: null,
        });
        expect(result.status).toBe('AMBIGUOUS');
        expect(result.solutionCount && result.solutionCount > 1).toBe(true);
    });
});
