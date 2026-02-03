import React from 'react';
import { Box, Text } from 'ink';
import { SelectList, SelectItem } from '../components/index.js';
import { useStore } from '../context/store.js';
import type { CompetitiveRegion } from '../../data/index.js';

interface RegionSelectScreenProps {
  mode: 'team' | 'player';
}

export function RegionSelectScreen({ mode }: RegionSelectScreenProps): React.ReactElement {
  const navigate = useStore((s) => s.navigate);

  // WinCon scope: only NA and LATAM are supported team regions.
  const availableItems: SelectItem<CompetitiveRegion>[] = [
    { label: 'NA', value: 'NA' },
    { label: 'LATAM', value: 'LATAM' },
  ];
  const unavailableRegions = [
    'EMEA - Europe, Middle East, Africa',
    'Pacific - Asia Pacific',
    'China',
  ];

  const handleSelect = (item: SelectItem<CompetitiveRegion>) => {
    if (mode === 'team') {
      navigate('team-list', { region: item.value });
    } else {
      navigate('player-finder', { region: item.value });
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>
        Select a region to browse {mode === 'team' ? 'teams' : 'players'}:
      </Text>
      <Box marginTop={1}>
        <SelectList items={availableItems} onSelect={handleSelect} />
      </Box>
      {unavailableRegions.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>------------------------------</Text>
          <Text bold color="yellow">Coming Soon</Text>
          {unavailableRegions.map((region) => (
            <Text key={region} dimColor>  {region}</Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
