/**
 * Round Outcome & Momentum Model (v1)
 *
 * Implements locked spec from Version1.md:
 * - Uses only directly observable GRID data
 * - Round-outcome based logic only
 * - No per-player economy assumptions
 * - No inferred buy states or bonus rounds
 * - Per-map scouting focus
 *
 * Note: Spec says "Round 1 and Round 12" for pistol, but standard VALORANT
 * has pistol at Round 1 (first half) and Round 13 (second half after side swap).
 * Implementing with correct VALORANT round numbers: 1, 13 for pistol; 2, 14 for post-pistol.
 */
import type { Match } from '../data/models/index.js';
export type RoundType = 'pistol' | 'post-pistol' | 'gun';
export type Side = 'Attack' | 'Defense';
export interface RoundOutcome {
    roundNumber: number;
    roundType: RoundType;
    winnerTeamId: string;
    loserTeamId: string;
    winningSide: Side;
    losingSide: Side;
    duration?: string;
}
export interface RoundTimeline {
    matchId: string;
    matchDate: string;
    mapName: string;
    teamId: string;
    teamName: string;
    opponentId: string;
    opponentName: string;
    rounds: RoundOutcome[];
    mapWinner: string | null;
}
export interface SidePerformance {
    map: string;
    attackRoundsPlayed: number;
    attackRoundsWon: number;
    attackWinRate: number;
    defenseRoundsPlayed: number;
    defenseRoundsWon: number;
    defenseWinRate: number;
    strongerSide: Side | 'Even';
}
export interface PistolPerformance {
    map: string;
    pistolRoundsPlayed: number;
    pistolRoundsWon: number;
    pistolWinRate: number;
    attackPistolWins: number;
    attackPistolPlayed: number;
    attackPistolWinRate: number;
    defensePistolWins: number;
    defensePistolPlayed: number;
    defensePistolWinRate: number;
    mapWinsGivenPistolWin: number;
    mapLossesGivenPistolWin: number;
    mapWinRateGivenPistolWin: number;
    mapWinsGivenPistolLoss: number;
    mapLossesGivenPistolLoss: number;
    mapWinRateGivenPistolLoss: number;
}
export interface PostPistolPerformance {
    map: string;
    postPistolRoundsPlayed: number;
    postPistolRoundsWon: number;
    postPistolWinRate: number;
    pistolWinThenPostPistolWin: number;
    pistolWinThenPostPistolLoss: number;
    pistolLossThenPostPistolWin: number;
    pistolLossThenPostPistolLoss: number;
    postPistolWinRateAfterPistolWin: number;
    forceBreakRate: number;
}
export interface StreakStats {
    map: string;
    maxStreak: number;
    avgStreakLength: number;
    twoRoundStreaks: number;
    threeRoundStreaks: number;
    fourPlusStreaks: number;
    totalStreaks: number;
}
export interface StreakContinuation {
    map: string;
    winAfter1Win: number;
    winAfter1WinSamples: number;
    winAfter2Wins: number;
    winAfter2WinsSamples: number;
    winAfter3Wins: number;
    winAfter3WinsSamples: number;
}
export interface HalfPerformance {
    map: string;
    firstHalfWins: number;
    firstHalfPlayed: number;
    firstHalfWinRate: number;
    secondHalfWins: number;
    secondHalfPlayed: number;
    secondHalfWinRate: number;
    lastRoundFirstHalfWins: number;
    lastRoundFirstHalfPlayed: number;
    firstRoundSecondHalfWins: number;
    firstRoundSecondHalfPlayed: number;
}
export interface HeatZone {
    roundRange: string;
    startRound: number;
    endRound: number;
    winRate: number;
    streakStartRate: number;
    streakEndRate: number;
    significance: 'high' | 'medium' | 'low';
}
export interface MapConditionalSignals {
    map: string;
    mapWinRateGivenPistolWin: number;
    mapWinRateGivenPostPistolWin: number;
    mapWinRateGivenEarlyStreak: number;
    samples: {
        pistolWins: number;
        postPistolWins: number;
        earlyStreaks: number;
    };
}
export interface RoundOutcomeReport {
    entityType: 'team' | 'player';
    entityId: string;
    entityName: string;
    timelines: RoundTimeline[];
    sidePerformance: SidePerformance[];
    pistolPerformance: PistolPerformance[];
    postPistolPerformance: PostPistolPerformance[];
    streakStats: StreakStats[];
    streakContinuation: StreakContinuation[];
    halfPerformance: HalfPerformance[];
    heatZones: HeatZone[];
    conditionalSignals: MapConditionalSignals[];
    aggregated: {
        totalMaps: number;
        overallWinRate: number;
        overallPistolWinRate: number;
        overallAttackWinRate: number;
        overallDefenseWinRate: number;
    };
}
export declare function buildRoundOutcomeReport(entityType: 'team' | 'player', entityId: string, entityName: string, matches: Match[]): RoundOutcomeReport;
