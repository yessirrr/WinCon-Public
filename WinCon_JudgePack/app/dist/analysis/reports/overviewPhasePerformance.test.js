import { describe, it, expect } from 'vitest';
import { computePhasePerformance } from './overviewReport.js';
const TEAM_ID = 'team-1';
function makeRound(params) {
    const hasPlantOccurred = Object.prototype.hasOwnProperty.call(params, 'plantOccurred');
    const plantOccurred = hasPlantOccurred
        ? params.plantOccurred
        : params.plantTimeSec !== null && params.plantTimeSec !== undefined;
    return {
        roundNumber: 1,
        winnerId: params.winnerId ?? '',
        winType: params.winType ?? 'spike_detonation',
        side: params.side ? { [TEAM_ID]: params.side } : {},
        economy: [],
        playerStats: [],
        plantOccurred,
        plantTimeSec: params.plantTimeSec ?? null,
    };
}
describe('computePhasePerformance', () => {
    it('computes post-plant and retake rates with median plant time', () => {
        const rounds = [
            makeRound({ side: 'attacker', winnerId: TEAM_ID, plantTimeSec: 30 }),
            makeRound({ side: 'attacker', winnerId: 'opp', plantTimeSec: 40 }),
            makeRound({ side: 'defender', winnerId: TEAM_ID, plantTimeSec: 25 }),
            makeRound({ side: 'defender', winnerId: 'opp', plantTimeSec: null }),
        ];
        const matches = [{
                maps: [{ mapName: 'Ascent', rounds }],
            }];
        const result = computePhasePerformance(matches, TEAM_ID, {});
        expect(result.overall.attackPostPlant.rounds).toBe(2);
        expect(result.overall.attackPostPlant.wins).toBe(1);
        expect(result.overall.defenseRetake.rounds).toBe(1);
        expect(result.overall.defenseRetake.wins).toBe(1);
        expect(result.overall.medianPlantTimeSec).toBe(35);
        expect(result.byMap.Ascent.attackPostPlant.rounds).toBe(2);
        expect(result.byMap.Ascent.defenseRetake.rounds).toBe(1);
    });
    it('skips rounds without side, winner, or plant event', () => {
        const rounds = [
            makeRound({ side: 'attacker', winnerId: TEAM_ID, plantTimeSec: null }),
            makeRound({ side: undefined, winnerId: TEAM_ID, plantTimeSec: 20 }),
            makeRound({ side: 'attacker', winnerId: '', plantTimeSec: 20 }),
        ];
        const matches = [{
                maps: [{ mapName: 'Split', rounds }],
            }];
        const result = computePhasePerformance(matches, TEAM_ID, {});
        expect(result.overall.attackPostPlant.rounds).toBe(0);
        expect(result.overall.defenseRetake.rounds).toBe(0);
        expect(result.overall.medianPlantTimeSec).toBeNull();
    });
    it('counts planted rounds from spike winType when plantOccurred is missing', () => {
        const rounds = [
            makeRound({ side: 'attacker', winnerId: TEAM_ID, plantOccurred: undefined, winType: 'spike_defuse' }),
            makeRound({ side: 'defender', winnerId: 'opp', plantOccurred: undefined, winType: 'spike_detonation' }),
        ];
        const matches = [{
                maps: [{ mapName: 'Lotus', rounds }],
            }];
        const result = computePhasePerformance(matches, TEAM_ID, {});
        expect(result.overall.attackPostPlant.rounds).toBe(1);
        expect(result.overall.defenseRetake.rounds).toBe(1);
        expect(result.overall.medianPlantTimeSec).toBeNull();
    });
});
