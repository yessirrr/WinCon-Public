import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { Loading } from '../components/index.js';
import { useStore } from '../context/store.js';
import { getPlayerById, getTeamById, searchPlayerByName, getPlayerMatches } from '../../data/index.js';
const STAT_OPTIONS = ['Performance', 'Agent Pool', 'By Map'];
const PANEL_WIDTH = 58;
function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
function borderLine(char) {
    return char.repeat(PANEL_WIDTH);
}
function padLine(content) {
    const visible = content.length;
    const pad = Math.max(0, PANEL_WIDTH - visible);
    return content + ' '.repeat(pad);
}
function computePerformance(matches, playerId) {
    let kills = 0, deaths = 0, assists = 0, roundsPlayed = 0;
    let kastRounds = 0;
    for (const match of matches) {
        for (const map of match.maps) {
            for (const round of map.rounds) {
                const ps = round.playerStats.find(s => s.playerId === playerId);
                if (ps) {
                    kills += ps.kills;
                    deaths += ps.deaths;
                    assists += ps.assists;
                    roundsPlayed++;
                    // KAST: Kill, Assist, Survived, or Traded
                    // K: got a kill, A: got an assist, S: survived (deaths === 0)
                    // T: traded - approximated as: died but teammate got a kill in same round
                    const hasKill = ps.kills > 0;
                    const hasAssist = ps.assists > 0;
                    const survived = ps.deaths === 0;
                    // Check if traded: player died but a teammate got a kill
                    const traded = ps.deaths > 0 && round.playerStats.some(other => other.teamId === ps.teamId && other.playerId !== playerId && other.kills > 0);
                    if (hasKill || hasAssist || survived || traded) {
                        kastRounds++;
                    }
                }
            }
        }
    }
    const kd = deaths > 0 ? kills / deaths : kills;
    const kda = deaths > 0 ? (kills + assists) / deaths : kills + assists;
    const kastPercent = roundsPlayed > 0 ? (kastRounds / roundsPlayed) * 100 : null;
    return { kills, deaths, assists, roundsPlayed, kd, kda, kastPercent, kastRounds };
}
function computeAgentPool(matches, playerId) {
    const agents = {};
    for (const match of matches) {
        const teamId = match.teams.find(t => match.maps.some(m => m.rounds.some(r => r.playerStats.some(s => s.playerId === playerId && s.teamId === t.teamId))))?.teamId;
        for (const map of match.maps) {
            // Track which agents appeared on this map (for map-level counting)
            const agentSeenOnMap = new Set();
            for (const round of map.rounds) {
                const ps = round.playerStats.find(s => s.playerId === playerId);
                if (ps) {
                    const name = ps.agent.name;
                    if (!agents[name]) {
                        agents[name] = { name, rounds: 0, wins: 0, losses: 0, mapCounts: {}, totalMaps: 0 };
                    }
                    agents[name].rounds++;
                    if (round.winnerId === teamId) {
                        agents[name].wins++;
                    }
                    else {
                        agents[name].losses++;
                    }
                    agentSeenOnMap.add(name);
                }
            }
            // Increment map-played counts once per map per agent
            for (const agentName of agentSeenOnMap) {
                agents[agentName].mapCounts[map.mapName] = (agents[agentName].mapCounts[map.mapName] || 0) + 1;
                agents[agentName].totalMaps++;
            }
        }
    }
    return Object.values(agents).sort((a, b) => b.totalMaps - a.totalMaps);
}
function computeByMap(matches, playerId) {
    const maps = {};
    for (const match of matches) {
        for (const map of match.maps) {
            const played = map.rounds.some(r => r.playerStats.some(s => s.playerId === playerId));
            if (!played)
                continue;
            if (!maps[map.mapName]) {
                maps[map.mapName] = { kills: 0, deaths: 0, mapsPlayed: 0 };
            }
            maps[map.mapName].mapsPlayed++;
            for (const round of map.rounds) {
                const ps = round.playerStats.find(s => s.playerId === playerId);
                if (ps) {
                    maps[map.mapName].kills += ps.kills;
                    maps[map.mapName].deaths += ps.deaths;
                }
            }
        }
    }
    return Object.entries(maps)
        .map(([mapName, data]) => ({
        mapName,
        mapsPlayed: data.mapsPlayed,
        kills: data.kills,
        deaths: data.deaths,
        kd: data.deaths > 0 ? data.kills / data.deaths : data.kills,
    }))
        .sort((a, b) => b.mapsPlayed - a.mapsPlayed);
}
function renderPanel(lines) {
    const output = [];
    output.push(`\u250C\u2500${borderLine('\u2500')}\u2500\u2510`);
    for (const line of lines) {
        output.push(`\u2502 ${padLine(line)} \u2502`);
    }
    output.push(`\u2514\u2500${borderLine('\u2500')}\u2500\u2518`);
    return output;
}
function PerformancePanel({ data, playerName }) {
    const kastDisplay = data.kastPercent !== null ? `${data.kastPercent.toFixed(1)}%` : '--';
    const lines = renderPanel([
        playerName,
        '',
        `Kills: ${data.kills}    Deaths: ${data.deaths}    Assists: ${data.assists}`,
        `Rounds Played: ${data.roundsPlayed}`,
        '',
        `K/D: ${data.kd.toFixed(2)}    KDA: ${data.kda.toFixed(2)}`,
        `KAST%: ${kastDisplay}    KAST (avg): ${data.kastRounds}/${data.roundsPlayed}`,
    ]);
    return (_jsx(Box, { flexDirection: "column", children: lines.map((line, i) => _jsx(Text, { children: line }, i)) }));
}
function AgentPoolPanel({ agents, playerName }) {
    // Find most played agent
    const mostPlayed = agents.length > 0 ? agents[0] : null;
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { bold: true, color: "cyan", children: [playerName, " - Agent Pool"] }), mostPlayed && (_jsxs(Box, { marginTop: 1, children: [_jsx(Text, { children: "Most played agent: " }), _jsx(Text, { bold: true, children: capitalize(mostPlayed.name) }), _jsxs(Text, { children: [" (", mostPlayed.totalMaps, " maps)"] })] })), _jsx(Box, { flexDirection: "column", marginTop: 1, children: agents.map((agent) => {
                    const total = agent.wins + agent.losses;
                    const wr = total > 0 ? (agent.wins / total) * 100 : 0;
                    const wrColor = wr >= 50 ? 'green' : 'yellow';
                    return (_jsxs(Box, { justifyContent: "space-between", width: PANEL_WIDTH, children: [_jsx(Text, { children: capitalize(agent.name) }), _jsxs(Box, { children: [_jsx(Text, { color: "yellow", children: "maps " }), _jsx(Text, { color: "yellow", children: String(agent.totalMaps).padStart(2) }), _jsx(Text, { children: "   " }), _jsxs(Text, { color: wrColor, children: [wr.toFixed(0), "% WR"] })] })] }, agent.name));
                }) })] }));
}
function ByMapPanel({ mapData, playerName }) {
    if (mapData.length < 2) {
        const lines = renderPanel([playerName, '', 'Not enough data (need 2+ maps)']);
        return (_jsx(Box, { flexDirection: "column", children: lines.map((line, i) => _jsx(Text, { children: line }, i)) }));
    }
    const contentLines = [playerName, ''];
    for (const m of mapData) {
        contentLines.push(`${capitalize(m.mapName)} (${m.mapsPlayed}): ${m.kd.toFixed(2)} K/D`);
    }
    const lines = renderPanel(contentLines);
    return (_jsx(Box, { flexDirection: "column", children: lines.map((line, i) => _jsx(Text, { children: line }, i)) }));
}
export function PlayerPageScreen() {
    const params = useStore((s) => s.navigation.params);
    const commandMode = useStore((s) => s.commandMode);
    const [player, setPlayer] = useState(null);
    const [team, setTeam] = useState(null);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Keep focus on first item by default, but don't auto-open any stat panel.
    const [selectedStat, setSelectedStat] = useState(0);
    const [expandedStat, setExpandedStat] = useState(null);
    const playerId = params?.playerId;
    const playerName = params?.playerName;
    useEffect(() => {
        // Reset advanced-stats focus/selection whenever a new player context is opened.
        setSelectedStat(0);
        setExpandedStat(null);
    }, [playerId, playerName]);
    useEffect(() => {
        if (!playerId && !playerName)
            return;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                let playerData = playerId ? await getPlayerById(playerId) : undefined;
                if (!playerData && playerName) {
                    playerData = await searchPlayerByName(playerName);
                }
                if (playerData) {
                    setPlayer(playerData);
                    const teamData = await getTeamById(playerData.teamId).catch(() => null);
                    setTeam(teamData || null);
                    const matchData = await getPlayerMatches(playerData.id).catch(() => []);
                    setMatches(matchData);
                }
            }
            catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load player');
            }
            finally {
                setLoading(false);
            }
        };
        load();
    }, [playerId, playerName]);
    useInput((input, key) => {
        if (commandMode)
            return;
        if (key.upArrow) {
            setSelectedStat(i => (i > 0 ? i - 1 : STAT_OPTIONS.length - 1));
        }
        else if (key.downArrow) {
            setSelectedStat(i => (i < STAT_OPTIONS.length - 1 ? i + 1 : 0));
        }
        else if (key.return) {
            const option = STAT_OPTIONS[selectedStat];
            setExpandedStat(prev => (prev === option ? null : option));
        }
    });
    const perfData = useMemo(() => {
        if (!player || matches.length === 0)
            return null;
        return computePerformance(matches, player.id);
    }, [matches, player]);
    const agentData = useMemo(() => {
        if (!player || matches.length === 0)
            return [];
        return computeAgentPool(matches, player.id);
    }, [matches, player]);
    const mapData = useMemo(() => {
        if (!player || matches.length === 0)
            return [];
        return computeByMap(matches, player.id);
    }, [matches, player]);
    if (loading) {
        return (_jsx(Box, { padding: 1, children: _jsx(Loading, { message: "Loading player..." }) }));
    }
    if (error) {
        return (_jsxs(Box, { padding: 1, flexDirection: "column", children: [_jsxs(Text, { color: "red", children: ["Error: ", error] }), _jsx(Text, { color: "gray", children: "Try /refresh to retry or check your connection." })] }));
    }
    if (!player) {
        return (_jsxs(Box, { padding: 1, flexDirection: "column", children: [_jsx(Text, { color: "red", children: "Player not found" }), _jsx(Text, { color: "gray", children: "Player data may have expired. Try searching again with /player." })] }));
    }
    const displayRole = player.role || 'Unknown';
    const displayTeam = team?.name || player.teamName || 'Unknown';
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: player.name }), player.realName && (_jsxs(_Fragment, { children: [_jsx(Text, { color: "gray", children: " - " }), _jsx(Text, { children: player.realName })] }))] }), _jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Team: " }), _jsx(Text, { children: displayTeam }), player.region && _jsxs(Text, { color: "gray", children: [" (", player.region, ")"] })] }), _jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Role: " }), _jsx(Text, { children: displayRole })] })] }), team && team.players.length > 1 && (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { bold: true, children: "Teammates" }), _jsx(Box, { children: _jsx(Text, { color: "gray", children: team.players
                                .filter(p => p.id !== player.id)
                                .map(p => p.name)
                                .join(', ') }) })] })), _jsx(Box, { marginBottom: 1, children: _jsx(Text, { color: "gray", children: '\u2500'.repeat(40) }) }), _jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { bold: true, children: "Advanced Stats" }), _jsx(Box, { flexDirection: "column", marginTop: 1, children: STAT_OPTIONS.map((option, idx) => (_jsxs(Box, { children: [_jsx(Text, { color: idx === selectedStat ? 'cyan' : 'gray', children: idx === selectedStat ? '\u25B6 ' : '  ' }), _jsx(Text, { bold: idx === selectedStat, color: expandedStat === option ? 'green' : undefined, children: option })] }, option))) })] }), expandedStat === 'Performance' && perfData && (_jsx(Box, { marginBottom: 1, children: _jsx(PerformancePanel, { data: perfData, playerName: player.name }) })), expandedStat === 'Agent Pool' && agentData.length > 0 && (_jsx(Box, { marginBottom: 1, children: _jsx(AgentPoolPanel, { agents: agentData, playerName: player.name }) })), expandedStat === 'By Map' && (_jsx(Box, { marginBottom: 1, children: _jsx(ByMapPanel, { mapData: mapData, playerName: player.name }) }))] }));
}
