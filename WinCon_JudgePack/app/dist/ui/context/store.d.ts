import type { ScreenType, ScreenParams, HistoryEntry, Report, ReportFilters } from '../../data/models/index.js';
interface NavigationState {
    currentScreen: ScreenType;
    params: ScreenParams | null;
    history: HistoryEntry[];
}
interface FilterState {
    teamFilters: ReportFilters;
    playerFilters: ReportFilters;
}
interface AppState {
    navigation: NavigationState;
    filters: FilterState;
    currentReport: Report | null;
    commandMode: boolean;
    showHelp: boolean;
    loading: boolean;
    error: string | null;
    selectedTeamId: string | null;
    selectedPlayerId: string | null;
    lastRefreshed: Date | null;
    refreshTrigger: number;
    momentumExpanded: boolean;
    econExpanded: boolean;
    winConditionExpanded: boolean;
}
interface AppActions {
    navigate: (screen: ScreenType, params?: ScreenParams | null) => void;
    goBack: () => void;
    goHome: () => void;
    setFilter: (key: keyof ReportFilters, value: unknown) => void;
    resetFilters: () => void;
    setReport: (report: Report | null) => void;
    setCommandMode: (active: boolean) => void;
    toggleHelp: () => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    toggleMomentum: () => void;
    toggleEcon: () => void;
    toggleWinCondition: () => void;
    resetCollapsibles: () => void;
    setSelectedTeam: (teamId: string | null) => void;
    setSelectedPlayer: (playerId: string | null) => void;
    getActiveFilters: () => ReportFilters;
    triggerRefresh: () => void;
}
export declare const useStore: import("zustand").UseBoundStore<import("zustand").StoreApi<AppState & AppActions>>;
export declare const selectCurrentScreen: (state: AppState) => ScreenType;
export declare const selectParams: (state: AppState) => ScreenParams | null;
export declare const selectCanGoBack: (state: AppState) => boolean;
export {};
