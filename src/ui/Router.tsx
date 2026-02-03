import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { useStore } from './context/store.js';
import {
  LandingScreen,
  RegionSelectScreen,
  TeamListScreen,
  PlayerFinderScreen,
  TeamPageScreen,
  PlayerPageScreen,
  MatchPageScreen,
  ReportViewScreen,
} from './screens/index.js';
import type { HistoryEntry, ScreenType, ScreenParams } from '../data/models/index.js';

/**
 * Router is memoized and subscribes only to route-related state.
 * This prevents re-render churn while typing in command input.
 */
export const Router = React.memo(function Router(): React.ReactElement {
  const navigation = useStore((s) => s.navigation);
  const currentScreen = navigation.currentScreen;
  const currentParams = navigation.params;
  const previousEntry = navigation.history.length > 0 ? navigation.history[navigation.history.length - 1] : null;
  // Stable identity keys ensure active/previous screen blocks only remount on actual route changes.
  const routeKey = buildRouteKey(currentScreen, currentParams);
  const historyKey = previousEntry ? buildRouteKey(previousEntry.screen, previousEntry.params) : '';

  const activeScreenEl = useMemo(
    () => <ScreenComponent key={`active:${routeKey}`} screen={currentScreen} />,
    [currentScreen, routeKey]
  );

  const inactiveScreenEl = useMemo(() => {
    if (!previousEntry) return null;
    return (
      <Box
        key={`inactive:${historyKey}`}
        flexDirection="column"
        marginTop={3}
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
      >
        <Text color="gray" dimColor>
          Previous Screen (inactive)
        </Text>
        <ScreenPreview key={`preview:${historyKey}`} entry={previousEntry} />
      </Box>
    );
  }, [historyKey, previousEntry]);

  return (
    <Box flexDirection="column">
      {/* Active screen stays pinned at the top and visually emphasized. */}
      <Box key={`active-wrap:${routeKey}`} borderStyle="single" borderColor="cyan" paddingX={1}>
        {activeScreenEl}
      </Box>

      {/* Previous route stays visible as de-emphasized context below with fixed offset. */}
      {inactiveScreenEl}
    </Box>
  );
});

function buildRouteKey(screen: ScreenType, params: ScreenParams | null): string {
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

const ScreenComponent = React.memo(function ScreenComponent({ screen }: { screen: ScreenType }): React.ReactElement {
  switch (screen) {
    case 'landing':
      return <LandingScreen />;
    case 'region-select-team':
      return <RegionSelectScreen mode="team" />;
    case 'region-select-player':
      return <RegionSelectScreen mode="player" />;
    case 'team-list':
      return <TeamListScreen />;
    case 'player-finder':
      return <PlayerFinderScreen />;
    case 'team-page':
      return <TeamPageScreen />;
    case 'player-page':
      return <PlayerPageScreen />;
    case 'match-page':
      return <MatchPageScreen />;
    case 'report-view':
      return <ReportViewScreen />;
    default:
      return <LandingScreen />;
  }
});

const ScreenPreview = React.memo(function ScreenPreview({ entry }: { entry: HistoryEntry }): React.ReactElement {
  const label = formatScreenName(entry.screen);
  const parts: string[] = [];
  if (entry.params?.region) parts.push(`Region: ${entry.params.region}`);
  if (entry.params?.teamName) parts.push(`Team: ${entry.params.teamName}`);
  if (entry.params?.playerName) parts.push(`Player: ${entry.params.playerName}`);
  if (entry.params?.matchId) parts.push(`Match: ${entry.params.matchId}`);

  return (
    <Box flexDirection="column">
      <Text color="gray">{label}</Text>
      {parts.length > 0 && (
        <Text color="gray" dimColor>
          {parts.join(' | ')}
        </Text>
      )}
    </Box>
  );
});

function formatScreenName(screen: ScreenType): string {
  const names: Record<ScreenType, string> = {
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
