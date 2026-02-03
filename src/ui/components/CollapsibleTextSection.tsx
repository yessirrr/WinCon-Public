import React from 'react';
import { Box, Text, useInput } from 'ink';
import { useStore } from '../context/store.js';

interface CollapsibleTextSectionProps {
  value: string;
  hotkey: string;
  label: string;
}

export function CollapsibleTextSection({
  value,
  hotkey,
  label,
}: CollapsibleTextSectionProps): React.ReactElement {
  const commandMode = useStore((s) => s.commandMode);
  const expanded = useStore((s) => s.winConditionExpanded);
  const toggleWinCondition = useStore((s) => s.toggleWinCondition);

  const renderFormattedText = (text: string): React.ReactElement => {
    const lines = text.split('\n');
    const renderLine = (line: string, idx: number): React.ReactElement => {
      const isFocus = line.startsWith('Strategic focus:');
      const segments: Array<{ text: string; bold: boolean; italic: boolean }> = [];
      let i = 0;
      let bold = false;
      let italic = false;
      while (i < line.length) {
        if (line.startsWith('**', i)) {
          bold = !bold;
          i += 2;
          continue;
        }
        if (line[i] === '*') {
          italic = !italic;
          i += 1;
          continue;
        }
        let j = i;
        while (j < line.length && !line.startsWith('**', j) && line[j] !== '*') {
          j += 1;
        }
        segments.push({ text: line.slice(i, j), bold, italic });
        i = j;
      }
      return (
        <Text key={idx} color={isFocus ? 'yellow' : undefined}>
          {segments.map((seg, segIdx) => (
            <Text key={segIdx} bold={seg.bold} italic={seg.italic}>
              {seg.text}
            </Text>
          ))}
        </Text>
      );
    };

    return (
      <Box flexDirection="column">
        {lines.map(renderLine)}
      </Box>
    );
  };

  useInput((input) => {
    if (input.toLowerCase() === hotkey.toLowerCase()) {
      toggleWinCondition();
    }
  }, { isActive: !commandMode });

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan">{expanded ? 'v' : '>'} </Text>
        <Text color="gray">
          Press <Text color="yellow">{hotkey.toUpperCase()}</Text> to {expanded ? 'collapse' : 'expand'} {label}
        </Text>
      </Box>
      {expanded && (
        <Box marginTop={1} flexDirection="column">
          {renderFormattedText(value)}
        </Box>
      )}
    </Box>
  );
}
