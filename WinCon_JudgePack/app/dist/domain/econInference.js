/**
 * Economy Inference - Markov-style hidden economy state + buy classification
 *
 * INFERRED DATA - Does not use actual credits, only observable outcomes.
 */
import { isPistolRound, isPostPistolRound, isHalfStart } from './roundAdapter.js';
import { ECON_TRANSITIONS, ECON_TO_BUY, LOSS_STREAK_BROKE_THRESHOLD, WIN_STREAK_RICH_THRESHOLD, SURVIVAL_ECON_BONUS, BASE_BUY_CONFIDENCE, STRONG_SIGNAL_CONFIDENCE_BOOST, UNCERTAIN_CONFIDENCE_PENALTY, } from './econModelConfig.js';
function initTeamState() {
    return {
        econState: 'LOW', // Pistol economy
        lossStreak: 0,
        winStreak: 0,
        lastSurvivors: 0,
    };
}
function updateTeamState(state, won, survivors, roundIndex) {
    // Reset at half start
    if (roundIndex !== undefined && isHalfStart(roundIndex)) {
        return {
            econState: 'LOW',
            lossStreak: 0,
            winStreak: 0,
            lastSurvivors: 0,
        };
    }
    const newState = { ...state };
    // Update streaks
    if (won) {
        newState.winStreak = state.winStreak + 1;
        newState.lossStreak = 0;
        newState.lastSurvivors = survivors ?? 0;
    }
    else {
        newState.lossStreak = state.lossStreak + 1;
        newState.winStreak = 0;
        newState.lastSurvivors = survivors ?? 0;
    }
    // Base transition
    const outcome = won ? 'win' : 'loss';
    let nextEcon = ECON_TRANSITIONS[state.econState]?.[outcome] ?? state.econState;
    // Adjustments based on streaks
    if (newState.lossStreak >= LOSS_STREAK_BROKE_THRESHOLD) {
        // Long loss streak forces BROKE
        nextEcon = 'BROKE';
    }
    else if (newState.winStreak >= WIN_STREAK_RICH_THRESHOLD) {
        // Win streak pushes toward RICH
        nextEcon = 'RICH';
    }
    // Survival bonus - more survivors = better carryover
    if (won && survivors !== undefined && survivors > 2) {
        const bonus = (survivors - 2) * SURVIVAL_ECON_BONUS;
        if (bonus > 0.3 && nextEcon === 'OK') {
            nextEcon = 'RICH';
        }
        else if (bonus > 0.15 && nextEcon === 'LOW') {
            nextEcon = 'OK';
        }
    }
    newState.econState = nextEcon;
    return newState;
}
// ============================================================================
// Inference Functions
// ============================================================================
function inferEconState(state, roundIndex, won) {
    let confidence = BASE_BUY_CONFIDENCE;
    const notes = [];
    // Pistol rounds are always LOW economy
    if (isPistolRound(roundIndex)) {
        return {
            econState: 'LOW',
            confidence: 0.95,
            notes: 'Pistol round - fixed starting economy',
        };
    }
    // Post-pistol has predictable patterns
    if (isPostPistolRound(roundIndex)) {
        confidence += STRONG_SIGNAL_CONFIDENCE_BOOST;
        notes.push('Post-pistol round');
    }
    // Loss streak is strong signal
    if (state.lossStreak >= LOSS_STREAK_BROKE_THRESHOLD) {
        confidence += STRONG_SIGNAL_CONFIDENCE_BOOST;
        notes.push(`${state.lossStreak} loss streak`);
    }
    // Win streak is strong signal
    if (state.winStreak >= WIN_STREAK_RICH_THRESHOLD) {
        confidence += STRONG_SIGNAL_CONFIDENCE_BOOST * 0.8;
        notes.push(`${state.winStreak} win streak`);
    }
    // Cap confidence
    confidence = Math.min(confidence, 0.95);
    return {
        econState: state.econState,
        confidence,
        notes: notes.length > 0 ? notes.join(', ') : 'Inferred from outcomes',
    };
}
function inferBuyClass(econ, roundIndex) {
    // Pistol rounds are always ECO-equivalent (pistol buy)
    if (isPistolRound(roundIndex)) {
        return {
            buyClass: 'ECO',
            confidence: 0.95,
            notes: 'Pistol round',
        };
    }
    const buyClass = ECON_TO_BUY[econ.econState] ?? 'FULL_BUY';
    let confidence = econ.confidence;
    const notes = [];
    // Post-pistol adjustments
    if (isPostPistolRound(roundIndex)) {
        // Winner likely full buys, loser likely ecos
        notes.push('Post-pistol');
    }
    // Reduce confidence for middle states
    if (econ.econState === 'OK' || econ.econState === 'LOW') {
        confidence -= UNCERTAIN_CONFIDENCE_PENALTY;
        notes.push('Mid-range economy');
    }
    confidence = Math.max(0.3, Math.min(confidence, 0.95));
    return {
        buyClass,
        confidence,
        notes: notes.length > 0 ? notes.join(', ') : `From ${econ.econState} state`,
    };
}
// ============================================================================
// Main API
// ============================================================================
/**
 * Run economy inference for a team across all rounds in a map
 */
export function inferMapEconomy(rounds, teamId) {
    const results = [];
    let state = initTeamState();
    const econDist = { BROKE: 0, LOW: 0, OK: 0, RICH: 0 };
    const buyDist = { ECO: 0, HALF_BUY: 0, FULL_BUY: 0 };
    let totalConfidence = 0;
    for (const round of rounds) {
        // Reset state at half boundaries
        if (isHalfStart(round.roundIndex)) {
            state = initTeamState();
        }
        // Determine if this team won
        const won = round.winnerTeamId === teamId;
        const isAttack = round.attackTeamId === teamId;
        const survivors = isAttack ? round.attackSurvivors : round.defenseSurvivors;
        // Infer economy state (before the round)
        const econ = inferEconState(state, round.roundIndex, won);
        const buy = inferBuyClass(econ, round.roundIndex);
        results.push({
            roundIndex: round.roundIndex,
            teamId,
            econ,
            buy,
        });
        // Update distributions
        econDist[econ.econState]++;
        buyDist[buy.buyClass]++;
        totalConfidence += econ.confidence;
        // Update state for next round
        state = updateTeamState(state, won, survivors, round.roundIndex + 1);
    }
    // Convert counts to percentages
    const totalRounds = results.length || 1;
    const econDistPct = {
        BROKE: econDist.BROKE / totalRounds,
        LOW: econDist.LOW / totalRounds,
        OK: econDist.OK / totalRounds,
        RICH: econDist.RICH / totalRounds,
    };
    const buyDistPct = {
        ECO: buyDist.ECO / totalRounds,
        HALF_BUY: buyDist.HALF_BUY / totalRounds,
        FULL_BUY: buyDist.FULL_BUY / totalRounds,
    };
    return {
        mapName: rounds[0]?.mapName ?? 'Unknown',
        teamId,
        rounds: results,
        econDistribution: econDistPct,
        buyDistribution: buyDistPct,
        avgConfidence: totalConfidence / totalRounds,
    };
}
/**
 * Get economy state at a specific round boundary (for pause model)
 */
export function getEconAtRound(summary, roundIndex) {
    const roundEcon = summary.rounds.find(r => r.roundIndex === roundIndex);
    return roundEcon?.econ ?? null;
}
