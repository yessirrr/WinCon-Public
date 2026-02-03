/**
 * Round Adapter - Normalizes GRID round data into RoundObs for economy/tactical models
 */
import { FIRST_HALF_END, OVERTIME_START } from './econModelConfig.js';
// ============================================================================
// Helpers
// ============================================================================
/**
 * Parse ISO 8601 duration to seconds
 * Format: PT2M23.478S => 143.478
 */
function parseDurationToSec(duration) {
    if (!duration)
        return undefined;
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
    if (!match)
        return undefined;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseFloat(match[3] || '0');
    return hours * 3600 + minutes * 60 + seconds;
}
/**
 * Determine half tag from round number
 */
function getHalfTag(roundIndex) {
    if (roundIndex <= FIRST_HALF_END)
        return 'H1';
    if (roundIndex < OVERTIME_START)
        return 'H2';
    return 'OT';
}
/**
 * Get team IDs by side from round.side mapping
 */
function getTeamsBySide(round) {
    let attackTeamId = null;
    let defenseTeamId = null;
    for (const [teamId, side] of Object.entries(round.side)) {
        if (side === 'attacker')
            attackTeamId = teamId;
        else if (side === 'defender')
            defenseTeamId = teamId;
    }
    if (!attackTeamId || !defenseTeamId)
        return null;
    return { attackTeamId, defenseTeamId };
}
/**
 * Count deaths per team from playerStats
 */
function countDeathsByTeam(round) {
    const deaths = {};
    for (const ps of round.playerStats) {
        if (!deaths[ps.teamId])
            deaths[ps.teamId] = 0;
        deaths[ps.teamId] += ps.deaths;
    }
    return deaths;
}
// ============================================================================
// Main Adapter
// ============================================================================
/**
 * Convert a single Round to RoundObs
 */
export function roundToObs(round, mapName) {
    const teams = getTeamsBySide(round);
    if (!teams)
        return null;
    const { attackTeamId, defenseTeamId } = teams;
    const loserTeamId = round.winnerId === attackTeamId ? defenseTeamId : attackTeamId;
    const winnerSide = round.winnerId === attackTeamId ? 'attack' : 'defense';
    // Parse duration
    const durationSec = parseDurationToSec(round.duration);
    // Count deaths
    const deathsByTeam = countDeathsByTeam(round);
    const attackDeaths = deathsByTeam[attackTeamId] ?? undefined;
    const defenseDeaths = deathsByTeam[defenseTeamId] ?? undefined;
    // Calculate survivors (5 players per team)
    const attackSurvivors = attackDeaths !== undefined ? 5 - attackDeaths : undefined;
    const defenseSurvivors = defenseDeaths !== undefined ? 5 - defenseDeaths : undefined;
    return {
        roundIndex: round.roundNumber,
        halfTag: getHalfTag(round.roundNumber),
        mapName: mapName.charAt(0).toUpperCase() + mapName.slice(1).toLowerCase(),
        attackTeamId,
        defenseTeamId,
        winnerTeamId: round.winnerId,
        loserTeamId,
        winnerSide,
        durationSec,
        attackDeaths,
        defenseDeaths,
        attackSurvivors,
        defenseSurvivors,
    };
}
/**
 * Convert all rounds in a map to RoundObs array
 */
export function mapToRoundObs(map) {
    const observations = [];
    for (const round of map.rounds) {
        const obs = roundToObs(round, map.mapName);
        if (obs)
            observations.push(obs);
    }
    // Sort by round index
    observations.sort((a, b) => a.roundIndex - b.roundIndex);
    return observations;
}
/**
 * Check if round is a pistol round (R1 or R12 per spec)
 */
export function isPistolRound(roundIndex) {
    return roundIndex === 1 || roundIndex === 12;
}
/**
 * Check if round is a post-pistol round (R2 or R13 per spec)
 */
export function isPostPistolRound(roundIndex) {
    return roundIndex === 2 || roundIndex === 13;
}
/**
 * Check if round is start of a half (for economy reset)
 */
export function isHalfStart(roundIndex) {
    return roundIndex === 1 || roundIndex === 13;
}
