import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { useStore } from './context/store.js';
import { LandingScreen, RegionSelectScreen, TeamListScreen, PlayerFinderScreen, TeamPageScreen, PlayerPageScreen, MatchPageScreen, ReportViewScreen, } from './screens/index.js';
/**
 * Router is memoized and subscribes only to route-related state.
 * This prevents re-render churn while typing in command input.
 */
export const Router = React.memo(function Router() {
    const navigation = useStore((s) => s.navigation);
    const currentScreen = navigation.currentScreen;
    const currentParams = navigation.params;
    const previousEntry = navigation.history.length > 0 ? navigation.history[navigation.history.length - 1] : null;
    // Stable identity keys ensure active/previous screen blocks only remount on actual route changes.
    const routeKey = buildRouteKey(currentScreen, currentParams);
    const historyKey = previousEntry ? buildRouteKey(previousEntry.screen, previousEntry.params) : '';
    const activeScreenEl = useMemo(() => _jsx(ScreenComponent, { screen: currentScreen }, `active:${routeKey}`), [currentScreen, routeKey]);
    const inactiveScreenEl = useMemo(() => {
        if (!previousEntry)
            return null;
        return (_jsxs(Box, { flexDirection: "column", marginTop: 3, borderStyle: "single", borderColor: "gray", paddingX: 1, children: [_jsx(Text, { color: "gray", dimColor: true, children: "Previous Screen (inactive)" }), _jsx(ScreenPreview, { entry: previousEntry }, `preview:${historyKey}`)] }, `inactive:${historyKey}`));
    }, [historyKey, previousEntry]);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { borderStyle: "single", borderColor: "cyan", paddingX: 1, children: activeScreenEl }, `active-wrap:${routeKey}`), inactiveScreenEl] }));
});
function buildRouteKey(screen, params) {
    const teamIdentity = params?.teamId ?? (params?.teamName ? `teamName:${params.teamName}` : '');
    const playerIdentity = params?.playerId ?? (params?.playerName ? `playerName:${params.playerName}` : '');
    const parts = [
        screen,
        teamIdentity,
        playerIdentity,
        params?.matchId ?? '',
        params?.region ?? '',
    ];
    return parts.join('|');
}
const ScreenComponent = React.memo(function ScreenComponent({ screen }) {
    switch (screen) {
        case 'landing':
            return _jsx(LandingScreen, {});
        case 'region-select-team':
            return _jsx(RegionSelectScreen, { mode: "team" });
        case 'region-select-player':
            return _jsx(RegionSelectScreen, { mode: "player" });
        case 'team-list':
            return _jsx(TeamListScreen, {});
        case 'player-finder':
            return _jsx(PlayerFinderScreen, {});
        case 'team-page':
            return _jsx(TeamPageScreen, {});
        case 'player-page':
            return _jsx(PlayerPageScreen, {});
        case 'match-page':
            return _jsx(MatchPageScreen, {});
        case 'report-view':
            return _jsx(ReportViewScreen, {});
        default:
            return _jsx(LandingScreen, {});
    }
});
const ScreenPreview = React.memo(function ScreenPreview({ entry }) {
    const label = formatScreenName(entry.screen);
    const parts = [];
    if (entry.params?.region)
        parts.push(`Region: ${entry.params.region}`);
    if (entry.params?.teamName)
        parts.push(`Team: ${entry.params.teamName}`);
    if (entry.params?.playerName)
        parts.push(`Player: ${entry.params.playerName}`);
    if (entry.params?.matchId)
        parts.push(`Match: ${entry.params.matchId}`);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "gray", children: label }), parts.length > 0 && (_jsx(Text, { color: "gray", dimColor: true, children: parts.join(' | ') }))] }));
});
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
    return names[screen];
}
