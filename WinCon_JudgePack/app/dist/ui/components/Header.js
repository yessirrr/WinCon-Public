import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { useStore } from '../context/store.js';
export function Header() {
    const selectedTeamId = useStore((s) => s.selectedTeamId);
    const selectedPlayerId = useStore((s) => s.selectedPlayerId);
    const filters = useStore((s) => s.getActiveFilters());
    const currentScreen = useStore((s) => s.navigation.currentScreen);
    const currentReport = useStore((s) => s.currentReport);
    const getContextLabel = () => {
        if (currentScreen === 'report-view' && currentReport) {
            const label = currentReport.entityType === 'team' ? 'Team' : 'Player';
            return `${label}: ${currentReport.entityName}`;
        }
        if (selectedTeamId) {
            return `Team: ${selectedTeamId.replace('team-', '').toUpperCase()}`;
        }
        if (selectedPlayerId) {
            return `Player: ${selectedPlayerId.replace('player-', '')}`;
        }
        return null;
    };
    const getFilterLabel = () => {
        const parts = [];
        if (filters.window && filters.window !== 5) {
            parts.push(`last ${filters.window}`);
        }
        if (filters.map) {
            parts.push(filters.map);
        }
        if (filters.side && filters.side !== 'both') {
            parts.push(filters.side);
        }
        return parts.length > 0 ? parts.join(' | ') : null;
    };
    const contextLabel = getContextLabel();
    const filterLabel = getFilterLabel();
    return (_jsxs(Box, { flexDirection: "row", justifyContent: "space-between", paddingX: 1, borderStyle: "single", borderColor: "cyan", children: [_jsxs(Box, { children: [_jsx(Text, { bold: true, color: "cyan", children: "WINCON" }), _jsx(Text, { color: "gray", children: " | " }), _jsx(Text, { color: "white", children: formatScreenName(currentScreen) })] }), _jsxs(Box, { children: [contextLabel && (_jsxs(_Fragment, { children: [_jsx(Text, { color: "yellow", children: contextLabel }), filterLabel && _jsx(Text, { color: "gray", children: " | " })] })), filterLabel && _jsxs(Text, { color: "magenta", children: ["[", filterLabel, "]"] })] })] }));
}
function formatScreenName(screen) {
    const names = {
        landing: 'Home',
        'region-select-team': 'Select Region',
        'region-select-player': 'Select Region',
        'team-list': 'Teams',
        'player-finder': 'Find Player',
        'team-page': 'Team',
        'player-page': 'Player',
        'match-page': 'Match',
        'report-view': 'Report',
    };
    return names[screen] || screen;
}
