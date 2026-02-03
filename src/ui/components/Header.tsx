import React from 'react';
import { Box, Text } from 'ink';
import { useStore } from '../context/store.js';

export function Header(): React.ReactElement {
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
    const parts: string[] = [];
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

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      paddingX={1}
      borderStyle="single"
      borderColor="cyan"
    >
      <Box>
        <Text bold color="cyan">
          WINCON
        </Text>
        <Text color="gray"> | </Text>
        <Text color="white">{formatScreenName(currentScreen)}</Text>
      </Box>

      <Box>
        {contextLabel && (
          <>
            <Text color="yellow">{contextLabel}</Text>
            {filterLabel && <Text color="gray"> | </Text>}
          </>
        )}
        {filterLabel && <Text color="magenta">[{filterLabel}]</Text>}
      </Box>
    </Box>
  );
}

function formatScreenName(screen: string): string {
  const names: Record<string, string> = {
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
