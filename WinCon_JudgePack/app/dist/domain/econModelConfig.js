/**
 * Economy Model Configuration - Single source of truth for all economy inference constants
 *
 * VALORANT economy basics (for reference, not used directly):
 * - Win: +3000 base
 * - Loss: +1900 (1st), +2400 (2nd), +2900 (3+ streak)
 * - Kill: +200, Plant: +300, Defuse: +200
 * - Full buy threshold: ~3900-4500 per player (~20k team)
 * - Half buy threshold: ~2000-3000 per player (~12k team)
 * - Eco threshold: <1500 per player (~7k team)
 */
// ============================================================================
// Round Classification
// ============================================================================
/** Pistol rounds (spec: ONLY R1 and R12) */
export const PISTOL_ROUNDS = [1, 12];
/** Post-pistol anti-eco indicator rounds */
export const POST_PISTOL_ROUNDS = [2, 13];
/** First half rounds */
export const FIRST_HALF_END = 12;
/** Second half start */
export const SECOND_HALF_START = 13;
/** Overtime start */
export const OVERTIME_START = 25;
// ============================================================================
// Economy State Thresholds
// ============================================================================
/** Loss streak thresholds for economy state */
export const LOSS_STREAK_BROKE_THRESHOLD = 2;
export const LOSS_STREAK_LOW_THRESHOLD = 1;
/** Survival bonus weight (more survivors = more carryover wealth) */
export const SURVIVAL_ECON_BONUS = 0.15; // 15% boost per survivor above 2
/** Win streak bonus for economy */
export const WIN_STREAK_RICH_THRESHOLD = 2;
// ============================================================================
// Buy Classification Confidence
// ============================================================================
/** Base confidence for inferred buy class */
export const BASE_BUY_CONFIDENCE = 0.6;
/** Confidence boost for strong signals (pistol, post-pistol, long loss streak) */
export const STRONG_SIGNAL_CONFIDENCE_BOOST = 0.25;
/** Confidence penalty for uncertain states */
export const UNCERTAIN_CONFIDENCE_PENALTY = 0.2;
// ============================================================================
// Pause Model Weights
// ============================================================================
/** Weight for opponent momentum in pause score */
export const PAUSE_MOMENTUM_WEIGHT = 35;
/** Weight for leverage situations (close score, late game) */
export const PAUSE_LEVERAGE_WEIGHT = 30;
/** Weight for economy spiral risk */
export const PAUSE_ECON_RISK_WEIGHT = 25;
/** Weight for side swap proximity */
export const PAUSE_SIDE_SWAP_WEIGHT = 10;
/** Minimum pause score to recommend */
export const PAUSE_RECOMMENDATION_THRESHOLD = 40;
// ============================================================================
// Tactical Proxy Thresholds
// ============================================================================
/** Fast round duration threshold (seconds) */
export const FAST_ROUND_THRESHOLD_SEC = 60;
/** Slow round duration threshold (seconds) */
export const SLOW_ROUND_THRESHOLD_SEC = 90;
/** Minimum rounds needed for tactical proxy stats */
export const MIN_ROUNDS_FOR_TACTICAL_STATS = 5;
// ============================================================================
// State Transition Probabilities (simplified Markov)
// ============================================================================
/**
 * Economy state transition matrix (simplified)
 * Format: [currentState][outcome] => newState
 * outcome: 'win' | 'loss'
 */
export const ECON_TRANSITIONS = {
    BROKE: { win: 'LOW', loss: 'BROKE' },
    LOW: { win: 'OK', loss: 'BROKE' },
    OK: { win: 'RICH', loss: 'LOW' },
    RICH: { win: 'RICH', loss: 'OK' },
};
/**
 * Buy class mapping from economy state
 */
export const ECON_TO_BUY = {
    BROKE: 'ECO',
    LOW: 'HALF_BUY',
    OK: 'FULL_BUY',
    RICH: 'FULL_BUY',
};
