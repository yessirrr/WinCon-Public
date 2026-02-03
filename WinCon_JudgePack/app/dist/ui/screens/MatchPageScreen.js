import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { Loading } from '../components/index.js';
import { useStore } from '../context/store.js';
import { getTeamById, getTeamMatches } from '../../data/index.js';
function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
function parseIsoDuration(iso) {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
    if (!match)
        return 'N/A';
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = Math.floor(parseFloat(match[3] || '0'));
    const totalMin = hours * 60 + minutes;
    return `${totalMin}:${String(seconds).padStart(2, '0')}`;
}
function buildGroupedScoreboard(map, ourTeamId, teams) {
    const playerTotals = {};
    for (const round of map.rounds) {
        for (const ps of round.playerStats) {
            if (!playerTotals[ps.playerId]) {
                playerTotals[ps.playerId] = {
                    name: ps.playerNickname || ps.playerId,
                    agent: capitalize(ps.agent.name),
                    teamId: ps.teamId,
                    kills: 0, deaths: 0, assists: 0,
                };
            }
            playerTotals[ps.playerId].kills += ps.kills;
            playerTotals[ps.playerId].deaths += ps.deaths;
            playerTotals[ps.playerId].assists += ps.assists;
        }
    }
    const all = Object.values(playerTotals);
    const ourPlayers = all.filter(p => p.teamId === ourTeamId).sort((a, b) => b.kills - a.kills);
    const oppPlayers = all.filter(p => p.teamId !== ourTeamId).sort((a, b) => b.kills - a.kills);
    const ourTeam = teams.find(t => t.teamId === ourTeamId);
    const oppTeam = teams.find(t => t.teamId !== ourTeamId);
    const ourStats = map.teamStats.find(s => s.teamId === ourTeamId);
    const oppStats = map.teamStats.find(s => s.teamId !== ourTeamId);
    return {
        ourTeamName: ourTeam?.teamName || 'Team',
        ourScore: ourStats?.score ?? 0,
        ourPlayers,
        oppTeamName: oppTeam?.teamName || 'Opponent',
        oppScore: oppStats?.score ?? 0,
        oppPlayers,
    };
}
function buildRoundsWithScore(map, ourTeamId, teams) {
    let ourScore = 0;
    let oppScore = 0;
    return map.rounds.map(round => {
        const winnerTeam = teams.find(t => t.teamId === round.winnerId);
        const winnerName = winnerTeam?.teamName || '\u2014';
        if (round.winnerId) {
            if (round.winnerId === ourTeamId) {
                ourScore++;
            }
            else {
                oppScore++;
            }
        }
        const runningScore = round.winnerId ? `${ourScore}-${oppScore}` : 'N/A';
        const time = round.duration ? parseIsoDuration(round.duration) : 'N/A';
        return {
            roundNum: `R${round.roundNumber}`,
            winnerName,
            runningScore,
            time,
        };
    });
}
// --- Component ---
export function MatchPageScreen() {
    const params = useStore((s) => s.navigation.params);
    const commandMode = useStore((s) => s.commandMode);
    const teamId = params?.teamId;
    const matchId = params?.matchId;
    const [team, setTeam] = useState(null);
    const [match, setMatch] = useState(null);
    const [loading, setLoading] = useState(true);
    // ID-based selection state (single source of truth)
    const [selectedMapNumber, setSelectedMapNumber] = useState(null);
    const [mapCursor, setMapCursor] = useState(0);
    const [advancedExpanded, setAdvancedExpanded] = useState(false);
    useEffect(() => {
        if (!teamId)
            return;
        const load = async () => {
            setLoading(true);
            // Reset selection state on context change
            setSelectedMapNumber(null);
            setMapCursor(0);
            setAdvancedExpanded(false);
            try {
                const teamData = await getTeamById(teamId);
                setTeam(teamData || null);
                if (teamData) {
                    const allMatches = await getTeamMatches(teamData.id).catch(() => []);
                    // Find the specific match by ID
                    const found = matchId
                        ? allMatches.find(m => m.id === matchId)
                        : allMatches[0];
                    setMatch(found || null);
                }
            }
            finally {
                setLoading(false);
            }
        };
        load();
    }, [teamId, matchId]);
    // Derived data (memoized, deterministically sorted)
    const maps = useMemo(() => {
        if (!match)
            return [];
        // Sort by mapNumber for deterministic order
        return [...match.maps].sort((a, b) => a.mapNumber - b.mapNumber);
    }, [match]);
    // Derive selected map from ID, not cursor
    const selectedMap = useMemo(() => {
        if (selectedMapNumber === null)
            return null;
        return maps.find(m => m.mapNumber === selectedMapNumber) ?? null;
    }, [maps, selectedMapNumber]);
    const scoreboard = useMemo(() => {
        if (!selectedMap || !match || !team)
            return null;
        return buildGroupedScoreboard(selectedMap, team.id, match.teams);
    }, [selectedMap, match, team]);
    const roundTimeline = useMemo(() => {
        if (!selectedMap || !match || !team)
            return [];
        return buildRoundsWithScore(selectedMap, team.id, match.teams);
    }, [selectedMap, match, team]);
    // Keyboard navigation
    useInput((input, key) => {
        if (commandMode)
            return;
        // "A" key: toggle Advanced (only when a map is selected)
        if (input.toLowerCase() === 'a') {
            if (selectedMapNumber !== null) {
                setAdvancedExpanded(prev => !prev);
            }
            return;
        }
        // Backspace: go back one level
        if (key.backspace || key.delete) {
            if (selectedMapNumber !== null) {
                // From map view → back to maps list
                setSelectedMapNumber(null);
                setAdvancedExpanded(false);
            }
            else {
                // From maps list → back to team page
                useStore.getState().goBack();
            }
            return;
        }
        // Up/Down: navigate maps list
        if (key.upArrow || key.downArrow) {
            if (maps.length === 0)
                return;
            const dir = key.downArrow ? 1 : -1;
            const newCursor = (() => {
                const next = mapCursor + dir;
                if (next < 0)
                    return maps.length - 1;
                if (next >= maps.length)
                    return 0;
                return next;
            })();
            setMapCursor(newCursor);
            // If in map view, update selection to follow cursor
            if (selectedMapNumber !== null) {
                const newMap = maps[newCursor];
                if (newMap) {
                    setSelectedMapNumber(newMap.mapNumber);
                    setAdvancedExpanded(false);
                }
            }
            return;
        }
        // Enter: select map (show scoreboard)
        if (key.return) {
            if (selectedMapNumber === null && maps.length > 0) {
                const mapAtCursor = maps[mapCursor];
                if (mapAtCursor) {
                    setSelectedMapNumber(mapAtCursor.mapNumber);
                    setAdvancedExpanded(false);
                }
            }
            return;
        }
    });
    // --- RENDERING ---
    if (loading) {
        return (_jsx(Box, { padding: 1, children: _jsx(Loading, { message: "Loading match..." }) }));
    }
    if (!team) {
        return (_jsx(Box, { padding: 1, children: _jsx(Text, { color: "red", children: "Team not found" }) }));
    }
    if (!match) {
        return (_jsxs(Box, { padding: 1, flexDirection: "column", children: [_jsx(Text, { bold: true, color: "cyan", children: team.name }), _jsx(Text, { color: "yellow", children: "Match not found." })] }));
    }
    // Match header info
    const opponent = match.teams.find(t => t.teamId !== team.id);
    const teamScore = match.teams.find(t => t.teamId === team.id);
    const won = match.winner === team.id;
    // Scoreboard rendering (display-only, no selection)
    const HEADER_LINE = `${'Player'.padEnd(18)}${'Agent'.padEnd(14)}${'K'.padEnd(6)}${'D'.padEnd(6)}${'A'.padEnd(6)}`;
    const SEPARATOR = '\u2500'.repeat(50);
    const renderPlayerRow = (p, idx) => {
        const cells = `${p.name.padEnd(18)}${p.agent.padEnd(14)}${String(p.kills).padEnd(6)}${String(p.deaths).padEnd(6)}${String(p.assists).padEnd(6)}`;
        return (_jsx(Box, { children: _jsxs(Text, { children: ['  ', cells] }) }, idx));
    };
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsxs(Box, { marginBottom: 1, flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { bold: true, color: "cyan", children: team.shortName || team.name }), _jsx(Text, { children: " " }), _jsxs(Text, { bold: true, color: won ? 'green' : 'red', children: [teamScore?.score || 0, "-", opponent?.score || 0] }), _jsx(Text, { children: " vs " }), _jsx(Text, { bold: true, children: opponent?.teamName || 'Unknown' })] }), _jsxs(Text, { color: "gray", dimColor: true, children: [formatDate(match.startedAt), match.tournament?.name ? ` \u2022 ${match.tournament.name}` : ''] })] }), _jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, color: selectedMapNumber === null ? 'cyan' : 'gray', children: selectedMapNumber === null ? '[ Maps ]' : 'Maps' }), _jsx(Box, { flexDirection: "column", marginTop: 1, children: maps.length === 0 ? (_jsx(Text, { color: "gray", children: "No map data available." })) : (maps.map((map, idx) => {
                            const isAtCursor = idx === mapCursor;
                            const t1 = map.teamStats.find(s => s.teamId === team.id);
                            const t2 = map.teamStats.find(s => s.teamId !== team.id);
                            const mapWon = map.winner === team.id;
                            return (_jsxs(Box, { children: [_jsx(Text, { color: isAtCursor ? 'cyan' : 'gray', children: isAtCursor ? '\u25B6 ' : '  ' }), _jsx(Text, { bold: isAtCursor, children: capitalize(map.mapName) }), _jsx(Text, { children: " " }), _jsxs(Text, { color: mapWon ? 'green' : 'red', children: [t1?.score ?? 0, "-", t2?.score ?? 0] })] }, `map-${map.mapNumber}`));
                        })) })] }), selectedMap && scoreboard && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Text, { bold: true, color: "gray", children: ["Scoreboard \\u2014 ", capitalize(selectedMap.mapName)] }), scoreboard.ourPlayers.length === 0 && scoreboard.oppPlayers.length === 0 ? (_jsx(Text, { color: "gray", children: "No player data." })) : (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Box, { children: _jsxs(Text, { bold: true, color: "green", children: [scoreboard.ourTeamName, " (", scoreboard.ourScore, ")"] }) }), _jsx(Box, { children: _jsxs(Text, { bold: true, color: "cyan", children: ['  ', HEADER_LINE] }) }), _jsxs(Text, { color: "gray", children: ['  ', SEPARATOR] }), scoreboard.ourPlayers.map((p, i) => renderPlayerRow(p, i)), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "gray", children: ['  ', '\u2504'.repeat(50)] }) }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { bold: true, color: "red", children: [scoreboard.oppTeamName, " (", scoreboard.oppScore, ")"] }) }), _jsx(Box, { children: _jsxs(Text, { bold: true, color: "cyan", children: ['  ', HEADER_LINE] }) }), _jsxs(Text, { color: "gray", children: ['  ', SEPARATOR] }), scoreboard.oppPlayers.map((p, i) => renderPlayerRow(p, scoreboard.ourPlayers.length + i))] })), _jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Box, { children: [_jsxs(Text, { color: "cyan", children: [advancedExpanded ? '\u25BE' : '\u25B8', " "] }), _jsx(Text, { bold: true, children: "Rounds" }), _jsx(Text, { color: "gray", children: " (press " }), _jsx(Text, { color: "yellow", bold: true, children: "A" }), _jsxs(Text, { color: "gray", children: [" to ", advancedExpanded ? 'collapse' : 'expand', ")"] })] }), advancedExpanded && (_jsx(Box, { flexDirection: "column", marginLeft: 2, children: roundTimeline.length === 0 ? (_jsx(Text, { color: "gray", children: "No round timeline available." })) : (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { bold: true, color: "cyan", children: '  ' }), _jsx(Text, { bold: true, color: "cyan", children: 'Round'.padEnd(8) }), _jsx(Text, { bold: true, color: "cyan", children: 'Winner'.padEnd(22) }), _jsx(Text, { bold: true, color: "cyan", children: 'Score'.padEnd(8) }), _jsx(Text, { bold: true, color: "cyan", children: 'Time'.padEnd(8) })] }), _jsxs(Text, { color: "gray", children: ['  ', '\u2500'.repeat(46)] }), roundTimeline.map((row, idx) => {
                                            const cells = `${row.roundNum.padEnd(8)}${row.winnerName.padEnd(22)}${row.runningScore.padEnd(8)}${row.time.padEnd(8)}`;
                                            return (_jsx(Box, { children: _jsxs(Text, { children: ['  ', cells] }) }, `round-${idx}`));
                                        })] })) }))] })] })), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "gray", dimColor: true, children: ['\u2191\u2193', " Navigate  ", '\u21B5', " Select  ", '\u232B', " Back", selectedMapNumber !== null ? '  A: Advanced' : ''] }) })] }));
}
