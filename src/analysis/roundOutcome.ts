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

import type { Match, MapResult, Round } from '../data/models/index.js';

// =============================================================================
// Types
// =============================================================================

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
  // Conditional chains
  pistolWinThenPostPistolWin: number;
  pistolWinThenPostPistolLoss: number;
  pistolLossThenPostPistolWin: number; // Force break
  pistolLossThenPostPistolLoss: number;
  // Rates
  postPistolWinRateAfterPistolWin: number;
  forceBreakRate: number; // P(post-pistol win | pistol loss)
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
  // P(win next | won last N)
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
  // Performance around side swap
  lastRoundFirstHalfWins: number;
  lastRoundFirstHalfPlayed: number;
  firstRoundSecondHalfWins: number; // This is pistol round 13
  firstRoundSecondHalfPlayed: number;
}

export interface HeatZone {
  roundRange: string;
  startRound: number;
  endRound: number;
  winRate: number;
  streakStartRate: number; // How often streaks begin in this zone
  streakEndRate: number;   // How often streaks end in this zone
  significance: 'high' | 'medium' | 'low';
}

export interface MapConditionalSignals {
  map: string;
  mapWinRateGivenPistolWin: number;
  mapWinRateGivenPostPistolWin: number;
  mapWinRateGivenEarlyStreak: number; // 3+ consecutive wins in first 5 rounds
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

// =============================================================================
// Constants
// =============================================================================

// Pistol rounds in standard VALORANT
const PISTOL_ROUNDS = [1, 13];
// Post-pistol rounds (immediately after pistol)
const POST_PISTOL_ROUNDS = [2, 14];
// First half rounds
const FIRST_HALF_ROUNDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
// Second half rounds
const SECOND_HALF_START = 13;

// Heat zone definitions
const HEAT_ZONES = [
  { label: 'Early (1-4)', start: 1, end: 4 },
  { label: 'Mid-First (5-8)', start: 5, end: 8 },
  { label: 'Late-First (9-12)', start: 9, end: 12 },
  { label: 'Early-Second (13-16)', start: 13, end: 16 },
  { label: 'Mid-Second (17-20)', start: 17, end: 20 },
  { label: 'Late-Second (21-24)', start: 21, end: 24 },
];

// =============================================================================
// Helper Functions
// =============================================================================

function getRoundType(roundNumber: number): RoundType {
  if (PISTOL_ROUNDS.includes(roundNumber)) return 'pistol';
  if (POST_PISTOL_ROUNDS.includes(roundNumber)) return 'post-pistol';
  return 'gun';
}

function getSide(sideStr: 'attacker' | 'defender' | undefined): Side {
  return sideStr === 'attacker' ? 'Attack' : 'Defense';
}

function formatMapName(name: string): string {
  if (!name) return 'Unknown';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function formatDate(dateString?: string): string {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function safeRate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

// =============================================================================
// Timeline Builder
// =============================================================================

function buildTimeline(
  match: Match,
  map: MapResult,
  teamId: string
): RoundTimeline {
  const teamInfo = match.teams.find(t => t.teamId === teamId);
  const opponentInfo = match.teams.find(t => t.teamId !== teamId);
  const opponentId = opponentInfo?.teamId ?? 'unknown';

  const rounds: RoundOutcome[] = [];

  for (const round of map.rounds) {
    const winnerId = round.winnerId;
    const loserId = winnerId === teamId ? opponentId : teamId;

    // Get sides
    const teamSide = round.side?.[teamId];
    const opponentSide = round.side?.[opponentId];

    rounds.push({
      roundNumber: round.roundNumber,
      roundType: getRoundType(round.roundNumber),
      winnerTeamId: winnerId,
      loserTeamId: loserId,
      winningSide: getSide(winnerId === teamId ? teamSide : opponentSide),
      losingSide: getSide(loserId === teamId ? teamSide : opponentSide),
      duration: round.duration,
    });
  }

  // Determine map winner
  const teamStats = map.teamStats.find(ts => ts.teamId === teamId);
  const opponentStats = map.teamStats.find(ts => ts.teamId !== teamId);
  let mapWinner: string | null = null;
  if (teamStats && opponentStats) {
    if (teamStats.score > opponentStats.score) mapWinner = teamId;
    else if (opponentStats.score > teamStats.score) mapWinner = opponentId;
  }

  return {
    matchId: match.id,
    matchDate: formatDate(match.startedAt),
    mapName: formatMapName(map.mapName),
    teamId,
    teamName: teamInfo?.teamName ?? teamId,
    opponentId,
    opponentName: opponentInfo?.teamName ?? 'Opponent',
    rounds,
    mapWinner,
  };
}

// =============================================================================
// Side Performance
// =============================================================================

function computeSidePerformance(
  timelines: RoundTimeline[],
  teamId: string
): SidePerformance[] {
  const byMap = new Map<string, {
    attackWon: number;
    attackPlayed: number;
    defenseWon: number;
    defensePlayed: number;
  }>();

  for (const timeline of timelines) {
    const mapName = timeline.mapName;
    if (!byMap.has(mapName)) {
      byMap.set(mapName, { attackWon: 0, attackPlayed: 0, defenseWon: 0, defensePlayed: 0 });
    }
    const stats = byMap.get(mapName)!;

    for (const round of timeline.rounds) {
      // Determine team's side this round
      const teamWon = round.winnerTeamId === teamId;
      const teamSide = teamWon ? round.winningSide : round.losingSide;

      if (teamSide === 'Attack') {
        stats.attackPlayed++;
        if (teamWon) stats.attackWon++;
      } else {
        stats.defensePlayed++;
        if (teamWon) stats.defenseWon++;
      }
    }
  }

  const results: SidePerformance[] = [];
  for (const [map, stats] of byMap) {
    const attackWinRate = safeRate(stats.attackWon, stats.attackPlayed);
    const defenseWinRate = safeRate(stats.defenseWon, stats.defensePlayed);

    let strongerSide: Side | 'Even' = 'Even';
    if (Math.abs(attackWinRate - defenseWinRate) > 0.05) {
      strongerSide = attackWinRate > defenseWinRate ? 'Attack' : 'Defense';
    }

    results.push({
      map,
      attackRoundsPlayed: stats.attackPlayed,
      attackRoundsWon: stats.attackWon,
      attackWinRate,
      defenseRoundsPlayed: stats.defensePlayed,
      defenseRoundsWon: stats.defenseWon,
      defenseWinRate,
      strongerSide,
    });
  }

  return results.sort((a, b) => a.map.localeCompare(b.map));
}

// =============================================================================
// Pistol Performance
// =============================================================================

function computePistolPerformance(
  timelines: RoundTimeline[],
  teamId: string
): PistolPerformance[] {
  const byMap = new Map<string, {
    pistolWins: number;
    pistolPlayed: number;
    attackPistolWins: number;
    attackPistolPlayed: number;
    defensePistolWins: number;
    defensePistolPlayed: number;
    mapWinsAfterPistolWin: number;
    mapLossesAfterPistolWin: number;
    mapWinsAfterPistolLoss: number;
    mapLossesAfterPistolLoss: number;
  }>();

  for (const timeline of timelines) {
    const mapName = timeline.mapName;
    if (!byMap.has(mapName)) {
      byMap.set(mapName, {
        pistolWins: 0, pistolPlayed: 0,
        attackPistolWins: 0, attackPistolPlayed: 0,
        defensePistolWins: 0, defensePistolPlayed: 0,
        mapWinsAfterPistolWin: 0, mapLossesAfterPistolWin: 0,
        mapWinsAfterPistolLoss: 0, mapLossesAfterPistolLoss: 0,
      });
    }
    const stats = byMap.get(mapName)!;

    // Track pistol results for this map to determine conditional outcomes
    let wonAnyPistol = false;
    let lostAnyPistol = false;

    for (const round of timeline.rounds) {
      if (round.roundType !== 'pistol') continue;

      const teamWon = round.winnerTeamId === teamId;
      const teamSide = teamWon ? round.winningSide : round.losingSide;

      stats.pistolPlayed++;
      if (teamWon) {
        stats.pistolWins++;
        wonAnyPistol = true;
      } else {
        lostAnyPistol = true;
      }

      if (teamSide === 'Attack') {
        stats.attackPistolPlayed++;
        if (teamWon) stats.attackPistolWins++;
      } else {
        stats.defensePistolPlayed++;
        if (teamWon) stats.defensePistolWins++;
      }
    }

    // Map outcome conditionals
    const teamWonMap = timeline.mapWinner === teamId;
    if (wonAnyPistol) {
      if (teamWonMap) stats.mapWinsAfterPistolWin++;
      else stats.mapLossesAfterPistolWin++;
    }
    if (lostAnyPistol) {
      if (teamWonMap) stats.mapWinsAfterPistolLoss++;
      else stats.mapLossesAfterPistolLoss++;
    }
  }

  const results: PistolPerformance[] = [];
  for (const [map, stats] of byMap) {
    results.push({
      map,
      pistolRoundsPlayed: stats.pistolPlayed,
      pistolRoundsWon: stats.pistolWins,
      pistolWinRate: safeRate(stats.pistolWins, stats.pistolPlayed),
      attackPistolWins: stats.attackPistolWins,
      attackPistolPlayed: stats.attackPistolPlayed,
      attackPistolWinRate: safeRate(stats.attackPistolWins, stats.attackPistolPlayed),
      defensePistolWins: stats.defensePistolWins,
      defensePistolPlayed: stats.defensePistolPlayed,
      defensePistolWinRate: safeRate(stats.defensePistolWins, stats.defensePistolPlayed),
      mapWinsGivenPistolWin: stats.mapWinsAfterPistolWin,
      mapLossesGivenPistolWin: stats.mapLossesAfterPistolWin,
      mapWinRateGivenPistolWin: safeRate(
        stats.mapWinsAfterPistolWin,
        stats.mapWinsAfterPistolWin + stats.mapLossesAfterPistolWin
      ),
      mapWinsGivenPistolLoss: stats.mapWinsAfterPistolLoss,
      mapLossesGivenPistolLoss: stats.mapLossesAfterPistolLoss,
      mapWinRateGivenPistolLoss: safeRate(
        stats.mapWinsAfterPistolLoss,
        stats.mapWinsAfterPistolLoss + stats.mapLossesAfterPistolLoss
      ),
    });
  }

  return results.sort((a, b) => a.map.localeCompare(b.map));
}

// =============================================================================
// Post-Pistol Performance
// =============================================================================

function computePostPistolPerformance(
  timelines: RoundTimeline[],
  teamId: string
): PostPistolPerformance[] {
  const byMap = new Map<string, {
    postPistolWins: number;
    postPistolPlayed: number;
    pistolWinThenPostWin: number;
    pistolWinThenPostLoss: number;
    pistolLossThenPostWin: number;
    pistolLossThenPostLoss: number;
  }>();

  for (const timeline of timelines) {
    const mapName = timeline.mapName;
    if (!byMap.has(mapName)) {
      byMap.set(mapName, {
        postPistolWins: 0, postPistolPlayed: 0,
        pistolWinThenPostWin: 0, pistolWinThenPostLoss: 0,
        pistolLossThenPostWin: 0, pistolLossThenPostLoss: 0,
      });
    }
    const stats = byMap.get(mapName)!;

    // Build round lookup
    const roundByNumber = new Map<number, RoundOutcome>();
    for (const round of timeline.rounds) {
      roundByNumber.set(round.roundNumber, round);
    }

    // Check each post-pistol round
    for (const postPistolRound of POST_PISTOL_ROUNDS) {
      const postRound = roundByNumber.get(postPistolRound);
      if (!postRound) continue;

      const pistolRound = roundByNumber.get(postPistolRound - 1);
      if (!pistolRound) continue;

      const teamWonPistol = pistolRound.winnerTeamId === teamId;
      const teamWonPostPistol = postRound.winnerTeamId === teamId;

      stats.postPistolPlayed++;
      if (teamWonPostPistol) stats.postPistolWins++;

      if (teamWonPistol && teamWonPostPistol) stats.pistolWinThenPostWin++;
      if (teamWonPistol && !teamWonPostPistol) stats.pistolWinThenPostLoss++;
      if (!teamWonPistol && teamWonPostPistol) stats.pistolLossThenPostWin++;
      if (!teamWonPistol && !teamWonPostPistol) stats.pistolLossThenPostLoss++;
    }
  }

  const results: PostPistolPerformance[] = [];
  for (const [map, stats] of byMap) {
    const pistolWins = stats.pistolWinThenPostWin + stats.pistolWinThenPostLoss;
    const pistolLosses = stats.pistolLossThenPostWin + stats.pistolLossThenPostLoss;

    results.push({
      map,
      postPistolRoundsPlayed: stats.postPistolPlayed,
      postPistolRoundsWon: stats.postPistolWins,
      postPistolWinRate: safeRate(stats.postPistolWins, stats.postPistolPlayed),
      pistolWinThenPostPistolWin: stats.pistolWinThenPostWin,
      pistolWinThenPostPistolLoss: stats.pistolWinThenPostLoss,
      pistolLossThenPostPistolWin: stats.pistolLossThenPostWin,
      pistolLossThenPostPistolLoss: stats.pistolLossThenPostLoss,
      postPistolWinRateAfterPistolWin: safeRate(stats.pistolWinThenPostWin, pistolWins),
      forceBreakRate: safeRate(stats.pistolLossThenPostWin, pistolLosses),
    });
  }

  return results.sort((a, b) => a.map.localeCompare(b.map));
}

// =============================================================================
// Streak Analysis
// =============================================================================

function computeStreakStats(
  timelines: RoundTimeline[],
  teamId: string
): StreakStats[] {
  const byMap = new Map<string, number[]>(); // map -> array of streak lengths

  for (const timeline of timelines) {
    const mapName = timeline.mapName;
    if (!byMap.has(mapName)) {
      byMap.set(mapName, []);
    }
    const streaks = byMap.get(mapName)!;

    let currentStreak = 0;
    for (const round of timeline.rounds) {
      if (round.winnerTeamId === teamId) {
        currentStreak++;
      } else {
        if (currentStreak > 0) {
          streaks.push(currentStreak);
        }
        currentStreak = 0;
      }
    }
    // Don't forget the last streak
    if (currentStreak > 0) {
      streaks.push(currentStreak);
    }
  }

  const results: StreakStats[] = [];
  for (const [map, streaks] of byMap) {
    const maxStreak = streaks.length > 0 ? Math.max(...streaks) : 0;
    const avgStreakLength = streaks.length > 0
      ? streaks.reduce((a, b) => a + b, 0) / streaks.length
      : 0;
    const twoRoundStreaks = streaks.filter(s => s === 2).length;
    const threeRoundStreaks = streaks.filter(s => s === 3).length;
    const fourPlusStreaks = streaks.filter(s => s >= 4).length;

    results.push({
      map,
      maxStreak,
      avgStreakLength,
      twoRoundStreaks,
      threeRoundStreaks,
      fourPlusStreaks,
      totalStreaks: streaks.length,
    });
  }

  return results.sort((a, b) => a.map.localeCompare(b.map));
}

// =============================================================================
// Streak Continuation Probabilities
// =============================================================================

function computeStreakContinuation(
  timelines: RoundTimeline[],
  teamId: string
): StreakContinuation[] {
  const byMap = new Map<string, {
    after1: { wins: number; total: number };
    after2: { wins: number; total: number };
    after3: { wins: number; total: number };
  }>();

  for (const timeline of timelines) {
    const mapName = timeline.mapName;
    if (!byMap.has(mapName)) {
      byMap.set(mapName, {
        after1: { wins: 0, total: 0 },
        after2: { wins: 0, total: 0 },
        after3: { wins: 0, total: 0 },
      });
    }
    const stats = byMap.get(mapName)!;

    const rounds = timeline.rounds;
    for (let i = 1; i < rounds.length; i++) {
      const currentWon = rounds[i].winnerTeamId === teamId;

      // Check streak length before this round
      let streakBefore = 0;
      for (let j = i - 1; j >= 0; j--) {
        if (rounds[j].winnerTeamId === teamId) {
          streakBefore++;
        } else {
          break;
        }
      }

      if (streakBefore >= 1) {
        stats.after1.total++;
        if (currentWon) stats.after1.wins++;
      }
      if (streakBefore >= 2) {
        stats.after2.total++;
        if (currentWon) stats.after2.wins++;
      }
      if (streakBefore >= 3) {
        stats.after3.total++;
        if (currentWon) stats.after3.wins++;
      }
    }
  }

  const results: StreakContinuation[] = [];
  for (const [map, stats] of byMap) {
    results.push({
      map,
      winAfter1Win: safeRate(stats.after1.wins, stats.after1.total),
      winAfter1WinSamples: stats.after1.total,
      winAfter2Wins: safeRate(stats.after2.wins, stats.after2.total),
      winAfter2WinsSamples: stats.after2.total,
      winAfter3Wins: safeRate(stats.after3.wins, stats.after3.total),
      winAfter3WinsSamples: stats.after3.total,
    });
  }

  return results.sort((a, b) => a.map.localeCompare(b.map));
}

// =============================================================================
// Half Performance
// =============================================================================

function computeHalfPerformance(
  timelines: RoundTimeline[],
  teamId: string
): HalfPerformance[] {
  const byMap = new Map<string, {
    firstHalfWins: number;
    firstHalfPlayed: number;
    secondHalfWins: number;
    secondHalfPlayed: number;
    lastRoundFirstHalfWins: number;
    lastRoundFirstHalfPlayed: number;
    firstRoundSecondHalfWins: number;
    firstRoundSecondHalfPlayed: number;
  }>();

  for (const timeline of timelines) {
    const mapName = timeline.mapName;
    if (!byMap.has(mapName)) {
      byMap.set(mapName, {
        firstHalfWins: 0, firstHalfPlayed: 0,
        secondHalfWins: 0, secondHalfPlayed: 0,
        lastRoundFirstHalfWins: 0, lastRoundFirstHalfPlayed: 0,
        firstRoundSecondHalfWins: 0, firstRoundSecondHalfPlayed: 0,
      });
    }
    const stats = byMap.get(mapName)!;

    for (const round of timeline.rounds) {
      const teamWon = round.winnerTeamId === teamId;
      const roundNum = round.roundNumber;

      if (FIRST_HALF_ROUNDS.includes(roundNum)) {
        stats.firstHalfPlayed++;
        if (teamWon) stats.firstHalfWins++;

        // Last round of first half
        if (roundNum === 12) {
          stats.lastRoundFirstHalfPlayed++;
          if (teamWon) stats.lastRoundFirstHalfWins++;
        }
      } else {
        stats.secondHalfPlayed++;
        if (teamWon) stats.secondHalfWins++;

        // First round of second half (pistol)
        if (roundNum === SECOND_HALF_START) {
          stats.firstRoundSecondHalfPlayed++;
          if (teamWon) stats.firstRoundSecondHalfWins++;
        }
      }
    }
  }

  const results: HalfPerformance[] = [];
  for (const [map, stats] of byMap) {
    results.push({
      map,
      firstHalfWins: stats.firstHalfWins,
      firstHalfPlayed: stats.firstHalfPlayed,
      firstHalfWinRate: safeRate(stats.firstHalfWins, stats.firstHalfPlayed),
      secondHalfWins: stats.secondHalfWins,
      secondHalfPlayed: stats.secondHalfPlayed,
      secondHalfWinRate: safeRate(stats.secondHalfWins, stats.secondHalfPlayed),
      lastRoundFirstHalfWins: stats.lastRoundFirstHalfWins,
      lastRoundFirstHalfPlayed: stats.lastRoundFirstHalfPlayed,
      firstRoundSecondHalfWins: stats.firstRoundSecondHalfWins,
      firstRoundSecondHalfPlayed: stats.firstRoundSecondHalfPlayed,
    });
  }

  return results.sort((a, b) => a.map.localeCompare(b.map));
}

// =============================================================================
// Heat Zones
// =============================================================================

function computeHeatZones(
  timelines: RoundTimeline[],
  teamId: string
): HeatZone[] {
  // Track per zone: wins, played, streak starts, streak ends
  const zoneStats = new Map<string, {
    label: string;
    start: number;
    end: number;
    wins: number;
    played: number;
    streakStarts: number;
    streakEnds: number;
  }>();

  for (const zone of HEAT_ZONES) {
    zoneStats.set(zone.label, {
      label: zone.label,
      start: zone.start,
      end: zone.end,
      wins: 0,
      played: 0,
      streakStarts: 0,
      streakEnds: 0,
    });
  }

  for (const timeline of timelines) {
    const rounds = timeline.rounds;

    for (let i = 0; i < rounds.length; i++) {
      const round = rounds[i];
      const roundNum = round.roundNumber;
      const teamWon = round.winnerTeamId === teamId;

      // Find which zone this round belongs to
      const zone = HEAT_ZONES.find(z => roundNum >= z.start && roundNum <= z.end);
      if (!zone) continue;

      const stats = zoneStats.get(zone.label)!;
      stats.played++;
      if (teamWon) stats.wins++;

      // Streak start: team won this round but lost previous (or first round)
      const prevWon = i > 0 && rounds[i - 1].winnerTeamId === teamId;
      if (teamWon && !prevWon) {
        stats.streakStarts++;
      }

      // Streak end: team won previous but lost this round
      if (!teamWon && prevWon) {
        stats.streakEnds++;
      }
    }
  }

  const results: HeatZone[] = [];
  const totalPlayed = [...zoneStats.values()].reduce((sum, z) => sum + z.played, 0);
  const totalStreakStarts = [...zoneStats.values()].reduce((sum, z) => sum + z.streakStarts, 0);
  const totalStreakEnds = [...zoneStats.values()].reduce((sum, z) => sum + z.streakEnds, 0);

  for (const stats of zoneStats.values()) {
    const winRate = safeRate(stats.wins, stats.played);
    const streakStartRate = safeRate(stats.streakStarts, totalStreakStarts);
    const streakEndRate = safeRate(stats.streakEnds, totalStreakEnds);

    // Determine significance based on deviation from average
    const avgWinRate = totalPlayed > 0
      ? [...zoneStats.values()].reduce((sum, z) => sum + z.wins, 0) / totalPlayed
      : 0.5;

    let significance: 'high' | 'medium' | 'low' = 'medium';
    if (Math.abs(winRate - avgWinRate) > 0.15) significance = 'high';
    else if (Math.abs(winRate - avgWinRate) < 0.05) significance = 'low';

    results.push({
      roundRange: stats.label,
      startRound: stats.start,
      endRound: stats.end,
      winRate,
      streakStartRate,
      streakEndRate,
      significance,
    });
  }

  return results;
}

// =============================================================================
// Conditional Signals
// =============================================================================

function computeConditionalSignals(
  timelines: RoundTimeline[],
  teamId: string
): MapConditionalSignals[] {
  const byMap = new Map<string, {
    pistolWins: number;
    mapWinsAfterPistolWin: number;
    postPistolWins: number;
    mapWinsAfterPostPistolWin: number;
    earlyStreaks: number;
    mapWinsAfterEarlyStreak: number;
  }>();

  for (const timeline of timelines) {
    const mapName = timeline.mapName;
    if (!byMap.has(mapName)) {
      byMap.set(mapName, {
        pistolWins: 0, mapWinsAfterPistolWin: 0,
        postPistolWins: 0, mapWinsAfterPostPistolWin: 0,
        earlyStreaks: 0, mapWinsAfterEarlyStreak: 0,
      });
    }
    const stats = byMap.get(mapName)!;

    const teamWonMap = timeline.mapWinner === teamId;
    const rounds = timeline.rounds;

    // Pistol win
    const wonAnyPistol = rounds.some(
      r => r.roundType === 'pistol' && r.winnerTeamId === teamId
    );
    if (wonAnyPistol) {
      stats.pistolWins++;
      if (teamWonMap) stats.mapWinsAfterPistolWin++;
    }

    // Post-pistol win
    const wonAnyPostPistol = rounds.some(
      r => r.roundType === 'post-pistol' && r.winnerTeamId === teamId
    );
    if (wonAnyPostPistol) {
      stats.postPistolWins++;
      if (teamWonMap) stats.mapWinsAfterPostPistolWin++;
    }

    // Early streak (3+ consecutive wins in first 5 rounds)
    let earlyStreak = 0;
    let maxEarlyStreak = 0;
    for (const round of rounds.filter(r => r.roundNumber <= 5)) {
      if (round.winnerTeamId === teamId) {
        earlyStreak++;
        maxEarlyStreak = Math.max(maxEarlyStreak, earlyStreak);
      } else {
        earlyStreak = 0;
      }
    }
    if (maxEarlyStreak >= 3) {
      stats.earlyStreaks++;
      if (teamWonMap) stats.mapWinsAfterEarlyStreak++;
    }
  }

  const results: MapConditionalSignals[] = [];
  for (const [map, stats] of byMap) {
    results.push({
      map,
      mapWinRateGivenPistolWin: safeRate(stats.mapWinsAfterPistolWin, stats.pistolWins),
      mapWinRateGivenPostPistolWin: safeRate(stats.mapWinsAfterPostPistolWin, stats.postPistolWins),
      mapWinRateGivenEarlyStreak: safeRate(stats.mapWinsAfterEarlyStreak, stats.earlyStreaks),
      samples: {
        pistolWins: stats.pistolWins,
        postPistolWins: stats.postPistolWins,
        earlyStreaks: stats.earlyStreaks,
      },
    });
  }

  return results.sort((a, b) => a.map.localeCompare(b.map));
}

// =============================================================================
// Main Builder
// =============================================================================

export function buildRoundOutcomeReport(
  entityType: 'team' | 'player',
  entityId: string,
  entityName: string,
  matches: Match[]
): RoundOutcomeReport {
  // For players, we need to find their team in each match
  const timelines: RoundTimeline[] = [];

  for (const match of matches) {
    let teamId = entityId;

    // If entity is a player, find their team from the match
    if (entityType === 'player') {
      for (const map of match.maps) {
        for (const round of map.rounds) {
          const playerEntry = round.playerStats.find(ps => ps.playerId === entityId);
          if (playerEntry) {
            teamId = playerEntry.teamId;
            break;
          }
        }
        if (teamId !== entityId) break;
      }
    }

    for (const map of match.maps) {
      const timeline = buildTimeline(match, map, teamId);
      timelines.push(timeline);
    }
  }

  const teamId = entityType === 'team' ? entityId : timelines[0]?.teamId ?? entityId;

  // Compute all metrics
  const sidePerformance = computeSidePerformance(timelines, teamId);
  const pistolPerformance = computePistolPerformance(timelines, teamId);
  const postPistolPerformance = computePostPistolPerformance(timelines, teamId);
  const streakStats = computeStreakStats(timelines, teamId);
  const streakContinuation = computeStreakContinuation(timelines, teamId);
  const halfPerformance = computeHalfPerformance(timelines, teamId);
  const heatZones = computeHeatZones(timelines, teamId);
  const conditionalSignals = computeConditionalSignals(timelines, teamId);

  // Aggregate stats
  let totalRoundsWon = 0;
  let totalRoundsPlayed = 0;
  let totalPistolWins = 0;
  let totalPistolPlayed = 0;
  let totalAttackWins = 0;
  let totalAttackPlayed = 0;
  let totalDefenseWins = 0;
  let totalDefensePlayed = 0;

  for (const sp of sidePerformance) {
    totalAttackWins += sp.attackRoundsWon;
    totalAttackPlayed += sp.attackRoundsPlayed;
    totalDefenseWins += sp.defenseRoundsWon;
    totalDefensePlayed += sp.defenseRoundsPlayed;
    totalRoundsWon += sp.attackRoundsWon + sp.defenseRoundsWon;
    totalRoundsPlayed += sp.attackRoundsPlayed + sp.defenseRoundsPlayed;
  }

  for (const pp of pistolPerformance) {
    totalPistolWins += pp.pistolRoundsWon;
    totalPistolPlayed += pp.pistolRoundsPlayed;
  }

  return {
    entityType,
    entityId,
    entityName,
    timelines,
    sidePerformance,
    pistolPerformance,
    postPistolPerformance,
    streakStats,
    streakContinuation,
    halfPerformance,
    heatZones,
    conditionalSignals,
    aggregated: {
      totalMaps: timelines.length,
      overallWinRate: safeRate(totalRoundsWon, totalRoundsPlayed),
      overallPistolWinRate: safeRate(totalPistolWins, totalPistolPlayed),
      overallAttackWinRate: safeRate(totalAttackWins, totalAttackPlayed),
      overallDefenseWinRate: safeRate(totalDefenseWins, totalDefensePlayed),
    },
  };
}
