import { create } from 'zustand';
import type {
  ScreenType,
  ScreenParams,
  HistoryEntry,
  Report,
  ReportFilters,
} from '../../data/models/index.js';

// Navigation State
interface NavigationState {
  currentScreen: ScreenType;
  params: ScreenParams | null;
  history: HistoryEntry[];
}

// Filter State
interface FilterState {
  teamFilters: ReportFilters;
  playerFilters: ReportFilters;
}

// App State
interface AppState {
  // Navigation
  navigation: NavigationState;
  // Filters
  filters: FilterState;
  // Current report (if any)
  currentReport: Report | null;
  // Command mode
  commandMode: boolean;
  // Help overlay
  showHelp: boolean;
  // Loading state
  loading: boolean;
  // Error message
  error: string | null;
  // Selected context
  selectedTeamId: string | null;
  selectedPlayerId: string | null;
  // Data refresh tracking
  lastRefreshed: Date | null;
  refreshTrigger: number; // Increment to trigger refetch in screens
  // Collapsible section states (avoid closure issues in useInput)
  momentumExpanded: boolean;
  econExpanded: boolean;
  winConditionExpanded: boolean;
}

// Default filters
const DEFAULT_FILTERS: ReportFilters = {
  window: 5,
  map: undefined,
  side: 'both',
};

const SNAPSHOT_PARAM_KEYS: Array<keyof ScreenParams> = [
  'teamId',
  'teamName',
  'playerId',
  'playerName',
  'matchId',
  'region',
];

function cloneParams(params: ScreenParams | null | undefined): ScreenParams | null {
  if (!params) return null;
  const snapshot: ScreenParams = {};
  for (const key of SNAPSHOT_PARAM_KEYS) {
    const value = params[key];
    if (typeof value === 'string') {
      snapshot[key] = value;
    }
  }
  return snapshot;
}

// Actions
interface AppActions {
  // Navigation
  navigate: (screen: ScreenType, params?: ScreenParams | null) => void;
  goBack: () => void;
  goHome: () => void;

  // Filters
  setFilter: (key: keyof ReportFilters, value: unknown) => void;
  resetFilters: () => void;

  // Report
  setReport: (report: Report | null) => void;

  // UI
  setCommandMode: (active: boolean) => void;
  toggleHelp: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Collapsible sections
  toggleMomentum: () => void;
  toggleEcon: () => void;
  toggleWinCondition: () => void;
  resetCollapsibles: () => void;

  // Context
  setSelectedTeam: (teamId: string | null) => void;
  setSelectedPlayer: (playerId: string | null) => void;

  // Get active filters based on context
  getActiveFilters: () => ReportFilters;

  // Data refresh
  triggerRefresh: () => void;
}

export const useStore = create<AppState & AppActions>((set, get) => ({
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
    const currentEntry: HistoryEntry = {
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
      const targetScreen: ScreenType = state.currentReport.entityType === 'team' ? 'team-page' : 'player-page';
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

      const fallbackParams: ScreenParams = state.currentReport.entityType === 'team'
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
export const selectCurrentScreen = (state: AppState) => state.navigation.currentScreen;
export const selectParams = (state: AppState) => state.navigation.params;
export const selectCanGoBack = (state: AppState) => state.navigation.history.length > 0;
