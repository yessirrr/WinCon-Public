import React from 'react';
import { Box, Text } from 'ink';

interface CollapsibleProps {
  label: string;
  expanded: boolean;
  children: React.ReactNode;
}

export function Collapsible({ label, expanded, children }: CollapsibleProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan">{expanded ? '▾' : '▸'} </Text>
        <Text bold>{label}</Text>
      </Box>
      {expanded && (
        <Box flexDirection="column" marginLeft={2}>
          {children}
        </Box>
      )}
    </Box>
  );
}
