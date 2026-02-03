import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { Loading } from '../components/index.js';
import { useStore } from '../context/store.js';
import { getTeamsByCompetitiveRegion, fetchTeamFromGrid } from '../../data/index.js';
export function TeamListScreen() {
    const params = useStore((s) => s.navigation.params);
    const navigate = useStore((s) => s.navigate);
    const setSelectedTeam = useStore((s) => s.setSelectedTeam);
    const commandMode = useStore((s) => s.commandMode);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [cursor, setCursor] = useState(0);
    const region = params?.region;
    // Deterministic, memoized team list — stable across renders
    const teams = useMemo(() => {
        if (!region)
            return [];
        return getTeamsByCompetitiveRegion(region);
    }, [region]);
    const handleSelect = async (team) => {
        setLoading(true);
        setError(null);
        try {
            const fetched = await fetchTeamFromGrid(team.name);
            if (fetched) {
                setSelectedTeam(fetched.id);
                navigate('team-page', { teamId: fetched.id, teamName: team.name });
            }
            else {
                setError(`Could not find "${team.name}" in GRID database`);
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch team');
        }
        finally {
            setLoading(false);
        }
    };
    // Controlled keyboard selection — cursor is the single source of truth
    useInput((_input, key) => {
        if (commandMode || loading || teams.length === 0)
            return;
        if (key.upArrow) {
            setCursor(i => (i > 0 ? i - 1 : teams.length - 1));
        }
        if (key.downArrow) {
            setCursor(i => (i < teams.length - 1 ? i + 1 : 0));
        }
        if (key.return) {
            const team = teams[cursor];
            if (team)
                handleSelect(team);
        }
    });
    if (!region) {
        return (_jsx(Box, { padding: 1, children: _jsx(Text, { color: "red", children: "No region selected" }) }));
    }
    if (loading) {
        return (_jsx(Box, { padding: 1, children: _jsx(Loading, { message: "Fetching team roster from GRID..." }) }));
    }
    if (error) {
        return (_jsxs(Box, { padding: 1, flexDirection: "column", children: [_jsxs(Text, { color: "red", children: ["Error: ", error] }), _jsx(Text, { color: "gray", children: "Try selecting the team again or use /refresh." })] }));
    }
    if (teams.length === 0) {
        return (_jsx(Box, { padding: 1, children: _jsxs(Text, { color: "gray", children: ["No teams found for ", region] }) }));
    }
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsxs(Text, { bold: true, children: [region, " Teams (VCT 2025)"] }), _jsx(Box, { flexDirection: "column", marginTop: 1, children: teams.map((team, idx) => {
                    const isHighlighted = idx === cursor;
                    return (_jsxs(Box, { children: [_jsx(Text, { color: isHighlighted ? 'cyan' : 'gray', children: isHighlighted ? '\u25B6 ' : '  ' }), _jsx(Text, { bold: isHighlighted, color: isHighlighted ? 'cyan' : undefined, children: team.shortName }), _jsx(Text, { color: "gray", children: " - " }), _jsx(Text, { bold: isHighlighted, children: team.name })] }, team.name));
                }) }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "gray", dimColor: true, children: ['\u2191\u2193', " Navigate  ", '\u21B5', " Select"] }) })] }));
}
