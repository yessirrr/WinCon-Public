import { create } from 'zustand';
// Default filters
const DEFAULT_FILTERS = {
    window: 5,
    map: undefined,
    side: 'both',
};
const SNAPSHOT_PARAM_KEYS = [
    'teamId',
    'teamName',
    'playerId',
    'playerName',
    'matchId',
    'region',
];
function cloneParams(params) {
    if (!params)
        return null;
    const snapshot = {};
    for (const key of SNAPSHOT_PARAM_KEYS) {
        const value = params[key];
        if (typeof value === 'string') {
            snapshot[key] = value;
        }
    }
    return snapshot;
}
export const useStore = create((set, get) => ({
    // Initial state
    navigation: {
        currentScreen: 'landing',
        params: null,
        history: [],
    },
    filters: {
        teamFilters: { ...DEFAULT_FILTERS },
        playerFilters: { ...DEFAULT_FILTERS },
    },
    currentReport: null,
    commandMode: false,
    showHelp: false,
    loading: false,
    error: null,
    selectedTeamId: null,
    selectedPlayerId: null,
    lastRefreshed: null,
    refreshTrigger: 0,
    momentumExpanded: false,
    econExpanded: false,
    winConditionExpanded: false,
    // Navigation actions
    navigate: (screen, params) => {
        const state = get();
        const currentEntry = {
            screen: state.navigation.currentScreen,
            params: cloneParams(state.navigation.params),
        };
        set({
            navigation: {
                currentScreen: screen,
                params: cloneParams(params),
                history: [...state.navigation.history, currentEntry],
            },
            error: null,
        });
    },
    goBack: () => {
        const state = get();
        const history = [...state.navigation.history];
        if (state.navigation.currentScreen === 'report-view' && state.currentReport) {
            const targetScreen = state.currentReport.entityType === 'team' ? 'team-page' : 'player-page';
            for (let i = history.length - 1; i >= 0; i -= 1) {
                if (history[i].screen === targetScreen) {
                    const target = history[i];
                    set({
                        navigation: {
                            currentScreen: target.screen,
                            params: cloneParams(target.params),
                            history: history.slice(0, i).map((entry) => ({
                                screen: entry.screen,
                                params: cloneParams(entry.params),
                            })),
                        },
                        currentReport: null,
                        error: null,
                    });
                    return;
                }
            }
            const fallbackParams = state.currentReport.entityType === 'team'
                ? { teamId: state.currentReport.entityId, teamName: state.currentReport.entityName }
                : { playerId: state.currentReport.entityId, playerName: state.currentReport.entityName };
            const filteredHistory = state.currentReport.entityType === 'team'
                ? history.filter(entry => entry.screen !== 'player-page')
                : history;
            set({
                navigation: {
                    currentScreen: targetScreen,
                    params: cloneParams(fallbackParams),
                    history: filteredHistory.map((entry) => ({
                        screen: entry.screen,
                        params: cloneParams(entry.params),
                    })),
                },
                currentReport: null,
                error: null,
            });
            return;
        }
        const previous = history.pop();
        if (previous) {
            set({
                navigation: {
                    currentScreen: previous.screen,
                    params: cloneParams(previous.params),
                    history: history.map((entry) => ({
                        screen: entry.screen,
                        params: cloneParams(entry.params),
                    })),
                },
                currentReport: null,
                error: null,
            });
        }
    },
    goHome: () => {
        set({
            navigation: {
                currentScreen: 'landing',
                params: null,
                history: [],
            },
            currentReport: null,
            selectedTeamId: null,
            selectedPlayerId: null,
            error: null,
        });
    },
    // Filter actions
    setFilter: (key, value) => {
        const state = get();
        const isTeamContext = state.selectedTeamId !== null;
        const filterKey = isTeamContext ? 'teamFilters' : 'playerFilters';
        set({
            filters: {
                ...state.filters,
                [filterKey]: {
                    ...state.filters[filterKey],
                    [key]: value,
                },
            },
        });
    },
    resetFilters: () => {
        set({
            filters: {
                teamFilters: { ...DEFAULT_FILTERS },
                playerFilters: { ...DEFAULT_FILTERS },
            },
        });
    },
    // Report actions
    setReport: (report) => {
        // Reset collapsible states when loading a new report
        set({ currentReport: report, momentumExpanded: false, econExpanded: false, winConditionExpanded: false });
    },
    // UI actions
    setCommandMode: (active) => {
        set({ commandMode: active });
    },
    toggleHelp: () => {
        set((state) => ({ showHelp: !state.showHelp }));
    },
    setLoading: (loading) => {
        set({ loading });
    },
    setError: (error) => {
        set({ error });
    },
    // Collapsible section actions
    toggleMomentum: () => {
        set((state) => ({ momentumExpanded: !state.momentumExpanded }));
    },
    toggleEcon: () => {
        set((state) => ({ econExpanded: !state.econExpanded }));
    },
    toggleWinCondition: () => {
        set((state) => ({ winConditionExpanded: !state.winConditionExpanded }));
    },
    resetCollapsibles: () => {
        set({ momentumExpanded: false, econExpanded: false, winConditionExpanded: false });
    },
    // Context actions
    setSelectedTeam: (teamId) => {
        set((state) => ({
            selectedTeamId: teamId,
            // Reset team filters when team changes
            filters: {
                ...state.filters,
                teamFilters: { ...DEFAULT_FILTERS },
            },
        }));
    },
    setSelectedPlayer: (playerId) => {
        set((state) => ({
            selectedPlayerId: playerId,
            // Reset player filters when player changes
            filters: {
                ...state.filters,
                playerFilters: { ...DEFAULT_FILTERS },
            },
        }));
    },
    // Get active filters
    getActiveFilters: () => {
        const state = get();
        if (state.selectedTeamId) {
            return state.filters.teamFilters;
        }
        return state.filters.playerFilters;
    },
    // Trigger data refresh
    triggerRefresh: () => {
        set((state) => ({
            lastRefreshed: new Date(),
            refreshTrigger: state.refreshTrigger + 1,
        }));
    },
}));
// Selectors
export const selectCurrentScreen = (state) => state.navigation.currentScreen;
export const selectParams = (state) => state.navigation.params;
export const selectCanGoBack = (state) => state.navigation.history.length > 0;
