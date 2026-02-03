import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../../data');
let teamsCache = null;
let matchesCache = null;
export function loadTeams() {
    if (teamsCache)
        return teamsCache;
    const filePath = join(DATA_DIR, 'teams.json');
    if (!existsSync(filePath)) {
        console.error(`Teams fixture not found at ${filePath}`);
        return [];
    }
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    teamsCache = data.teams.map(t => ({
        id: t.id,
        name: t.name,
        shortName: t.shortName,
        region: t.region,
        players: t.players.map(p => ({
            id: p.id,
            name: p.name,
            teamId: t.id,
            teamName: t.name,
            region: t.region,
            role: p.role,
        })),
    }));
    return teamsCache;
}
export function loadMatches() {
    if (matchesCache)
        return matchesCache;
    const filePath = join(DATA_DIR, 'matches.json');
    if (!existsSync(filePath)) {
        console.error(`Matches fixture not found at ${filePath}`);
        return [];
    }
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    matchesCache = data.matches;
    return matchesCache;
}
export function getTeamById(teamId) {
    const teams = loadTeams();
    return teams.find(t => t.id === teamId);
}
export function getTeamByName(name) {
    const teams = loadTeams();
    const lower = name.toLowerCase();
    return teams.find(t => t.name.toLowerCase() === lower ||
        t.shortName.toLowerCase() === lower);
}
export function getTeamsByRegion(region) {
    const teams = loadTeams();
    return teams.filter(t => t.region === region);
}
export function getPlayerById(playerId) {
    const teams = loadTeams();
    for (const team of teams) {
        const player = team.players.find(p => p.id === playerId);
        if (player)
            return player;
    }
    return undefined;
}
export function getPlayerByName(name) {
    const teams = loadTeams();
    const lower = name.toLowerCase();
    for (const team of teams) {
        const player = team.players.find(p => p.name.toLowerCase() === lower);
        if (player)
            return player;
    }
    return undefined;
}
export function searchPlayers(query) {
    const teams = loadTeams();
    const lower = query.toLowerCase();
    const results = [];
    for (const team of teams) {
        for (const player of team.players) {
            if (player.name.toLowerCase().includes(lower)) {
                results.push(player);
            }
        }
    }
    return results;
}
export function getMatchById(matchId) {
    const matches = loadMatches();
    return matches.find(m => m.id === matchId);
}
export function getTeamMatches(teamId) {
    const matches = loadMatches();
    return matches.filter(m => m.teams.some(t => t.teamId === teamId));
}
export function getPlayerMatches(playerId) {
    const matches = loadMatches();
    return matches.filter(m => m.maps.some(map => map.rounds.some(round => round.playerStats.some(ps => ps.playerId === playerId))));
}
export function clearCache() {
    teamsCache = null;
    matchesCache = null;
}
