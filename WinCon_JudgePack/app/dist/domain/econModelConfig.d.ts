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
/** Pistol rounds (spec: ONLY R1 and R12) */
export declare const PISTOL_ROUNDS: readonly [1, 12];
/** Post-pistol anti-eco indicator rounds */
export declare const POST_PISTOL_ROUNDS: readonly [2, 13];
/** First half rounds */
export declare const FIRST_HALF_END = 12;
/** Second half start */
export declare const SECOND_HALF_START = 13;
/** Overtime start */
export declare const OVERTIME_START = 25;
/** Loss streak thresholds for economy state */
export declare const LOSS_STREAK_BROKE_THRESHOLD = 2;
export declare const LOSS_STREAK_LOW_THRESHOLD = 1;
/** Survival bonus weight (more survivors = more carryover wealth) */
export declare const SURVIVAL_ECON_BONUS = 0.15;
/** Win streak bonus for economy */
export declare const WIN_STREAK_RICH_THRESHOLD = 2;
/** Base confidence for inferred buy class */
export declare const BASE_BUY_CONFIDENCE = 0.6;
/** Confidence boost for strong signals (pistol, post-pistol, long loss streak) */
export declare const STRONG_SIGNAL_CONFIDENCE_BOOST = 0.25;
/** Confidence penalty for uncertain states */
export declare const UNCERTAIN_CONFIDENCE_PENALTY = 0.2;
/** Weight for opponent momentum in pause score */
export declare const PAUSE_MOMENTUM_WEIGHT = 35;
/** Weight for leverage situations (close score, late game) */
export declare const PAUSE_LEVERAGE_WEIGHT = 30;
/** Weight for economy spiral risk */
export declare const PAUSE_ECON_RISK_WEIGHT = 25;
/** Weight for side swap proximity */
export declare const PAUSE_SIDE_SWAP_WEIGHT = 10;
/** Minimum pause score to recommend */
export declare const PAUSE_RECOMMENDATION_THRESHOLD = 40;
/** Fast round duration threshold (seconds) */
export declare const FAST_ROUND_THRESHOLD_SEC = 60;
/** Slow round duration threshold (seconds) */
export declare const SLOW_ROUND_THRESHOLD_SEC = 90;
/** Minimum rounds needed for tactical proxy stats */
export declare const MIN_ROUNDS_FOR_TACTICAL_STATS = 5;
/**
 * Economy state transition matrix (simplified)
 * Format: [currentState][outcome] => newState
 * outcome: 'win' | 'loss'
 */
export declare const ECON_TRANSITIONS: Record<string, Record<'win' | 'loss', string>>;
/**
 * Buy class mapping from economy state
 */
export declare const ECON_TO_BUY: Record<string, string>;
