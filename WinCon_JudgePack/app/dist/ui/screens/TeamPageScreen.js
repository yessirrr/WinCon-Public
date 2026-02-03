import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { Loading, SelectableTable } from '../components/index.js';
import { useStore } from '../context/store.js';
import { getTeamById, getTeamMatches, fetchTeamFromGrid, getRosterMetadata } from '../../data/index.js';
function formatTournamentName(name) {
    const match = name.match(/\b202\d\b/); // keep through the year token
    if (match && match.index !== undefined) {
        const end = match.index + match[0].length;
        return name.slice(0, end).trim();
    }
    return name;
}
export function TeamPageScreen() {
    const params = useStore((s) => s.navigation.params);
    const refreshTrigger = useStore((s) => s.refreshTrigger);
    const lastRefreshed = useStore((s) => s.lastRefreshed);
    const navigate = useStore((s) => s.navigate);
    const setSelectedPlayer = useStore((s) => s.setSelectedPlayer);
    const setSelectedTeam = useStore((s) => s.setSelectedTeam);
    const commandMode = useStore((s) => s.commandMode);
    const [team, setTeam] = useState(null);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMatches, setLoadingMatches] = useState(false);
    const [error, setError] = useState(null);
    const [rosterAsOf, setRosterAsOf] = useState(null);
    const [fetchedAt, setFetchedAt] = useState(null);
    const [focusedSection, setFocusedSection] = useState('roster');
    const teamId = params?.teamId;
    const teamName = params?.teamName;
    useEffect(() => {
        if (!teamId && !teamName)
            return;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                // Try to get team by ID first, fall back to name search
                let teamData;
                if (teamId) {
                    teamData = await getTeamById(teamId);
                }
                if (!teamData && teamName) {
                    teamData = await fetchTeamFromGrid(teamName);
                }
                if (teamData) {
                    const currentSelectedTeamId = useStore.getState().selectedTeamId;
                    if (currentSelectedTeamId !== teamData.id) {
                        setSelectedTeam(teamData.id);
                    }
                    setTeam(teamData);
                    setFetchedAt(new Date());
                    setLoading(false);
                    // Get roster metadata for "as of" date
                    const metadata = await getRosterMetadata(teamData.id);
                    if (metadata?.asOfDate) {
                        setRosterAsOf(new Date(metadata.asOfDate).toLocaleDateString());
                    }
                    // Load matches in background
                    setLoadingMatches(true);
                    const matchData = await getTeamMatches(teamData.id, 5).catch(() => []);
                    setMatches(matchData);
                    setLoadingMatches(false);
                }
                else {
                    setError('Team not found');
                    setLoading(false);
                }
            }
            catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load team');
                setLoading(false);
            }
        };
        load();
    }, [teamId, teamName, refreshTrigger]); // Re-fetch when refreshTrigger changes
    const recentMatches = useMemo(() => matches.slice(0, 5), [matches]);
    const matchRows = useMemo(() => recentMatches.map((m) => {
        const opponent = m.teams.find((t) => t.teamId !== team?.id);
        const teamScore = m.teams.find((t) => t.teamId === team?.id);
        return [
            opponent?.teamName || 'Unknown',
            `${teamScore?.score || 0}-${opponent?.score || 0}`,
            formatTournamentName(m.tournament.name),
        ];
    }), [recentMatches, team]);
    useInput((_input, key) => {
        if (commandMode)
            return;
        if (key.tab) {
            setFocusedSection(prev => prev === 'roster' ? 'matches' : 'roster');
        }
    });
    // Format time ago for display
    const formatTimeAgo = (date) => {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        if (seconds < 60)
            return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60)
            return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24)
            return `${hours}h ago`;
        return date.toLocaleDateString();
    };
    if (loading) {
        return (_jsxs(Box, { padding: 1, flexDirection: "column", children: [_jsx(Loading, { message: "Fetching roster from recent matches..." }), _jsx(Text, { color: "gray", children: "Analyzing match participation data from GRID API" })] }));
    }
    if (error) {
        return (_jsxs(Box, { padding: 1, flexDirection: "column", children: [_jsxs(Text, { color: "red", children: ["Error: ", error] }), _jsx(Text, { color: "gray", children: "Try /refresh to retry or check your connection." })] }));
    }
    if (!team) {
        return (_jsx(Box, { padding: 1, children: _jsx(Text, { color: "red", children: "Team not found" }) }));
    }
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsxs(Box, { marginBottom: 1, flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { bold: true, color: "cyan", children: team.shortName }), _jsx(Text, { color: "gray", children: " - " }), _jsx(Text, { children: team.name }), _jsxs(Text, { color: "gray", children: [" (", team.region, ")"] })] }), fetchedAt && (_jsxs(Text, { color: "gray", dimColor: true, children: ["Data fetched ", formatTimeAgo(fetchedAt), " \u2022 /refresh to update"] }))] }), _jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsxs(Box, { children: [_jsx(Text, { bold: true, children: "Roster" }), rosterAsOf && _jsxs(Text, { color: "gray", children: [" (as of ", rosterAsOf, ")"] })] }), team.players.length > 0 ? (_jsx(SelectableTable, { headers: ['Player', 'Role'], rows: team.players.map((p) => [p.name, p.role || '-']), data: team.players, onSelect: (player) => {
                            setSelectedTeam(null); // Clear team context
                            setSelectedPlayer(player.id);
                            navigate('player-page', { playerId: player.id, playerName: player.name });
                        }, columnWidths: [20, 15], isFocused: focusedSection === 'roster' && !commandMode, hint: focusedSection === 'roster' ? '↵ Enter: View player  Tab: Switch section' : 'Tab: Switch section', resetKey: team.id })) : (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "yellow", children: "No roster data available" }), _jsx(Text, { color: "gray", children: "GRID API may not have match data for this team/region" })] }))] }), _jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { bold: true, children: "Recent Matches" }), loadingMatches ? (_jsx(Text, { color: "gray", children: "Loading matches from GRID..." })) : recentMatches.length > 0 ? (_jsx(SelectableTable, { headers: ['Opponent', 'Score', 'Tournament'], rows: matchRows, data: recentMatches, onSelect: (match) => {
                            navigate('match-page', { teamId: team.id, matchId: match.id });
                        }, columnWidths: [20, 8, 30], isFocused: focusedSection === 'matches' && !commandMode, hint: focusedSection === 'matches' ? '↵ Enter: View match  Tab: Switch section' : 'Tab: Switch section', resetKey: team.id })) : (_jsx(Text, { color: "gray", children: "No recent matches found" }))] }), _jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, children: "Reports" }), _jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Use " }), _jsx(Text, { color: "gray", children: "/pistol" }), _jsx(Text, { color: "gray", children: ", " }), _jsx(Text, { color: "gray", children: "/overview" }), _jsx(Text, { color: "gray", children: ", or " }), _jsx(Text, { color: "yellow", children: "/wincon" }), _jsx(Text, { color: "gray", children: " commands" })] })] })] }));
}
