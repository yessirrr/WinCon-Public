import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

interface SelectableTableProps<T> {
  headers: string[];
  rows: string[][];           // Display data for rendering
  data: T[];                  // Underlying data objects
  onSelect: (item: T, index: number) => void;
  columnWidths?: number[];
  isFocused?: boolean;        // Whether this table accepts keyboard input
  hint?: string;              // Hint text shown below table
  resetKey?: string;          // When this changes, reset selectedIndex to 0
}

export function SelectableTable<T>({
  headers,
  rows,
  data,
  onSelect,
  columnWidths,
  isFocused = true,
  hint,
  resetKey,
}: SelectableTableProps<T>): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset cursor when resetKey changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [resetKey]);

  // Clamp cursor when data shrinks
  useEffect(() => {
    setSelectedIndex(prev => Math.min(prev, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  useInput((input, key) => {
    if (!isFocused) return;

    if (key.upArrow) {
      setSelectedIndex(i => (i > 0 ? i - 1 : rows.length - 1));
    }
    if (key.downArrow) {
      setSelectedIndex(i => (i < rows.length - 1 ? i + 1 : 0));
    }
    if (key.return) {
      if (data[selectedIndex]) {
        onSelect(data[selectedIndex], selectedIndex);
      }
    }
  }, { isActive: isFocused });

  // Calculate column widths if not provided
  const widths = columnWidths || headers.map((header, i) => {
    const maxContentWidth = Math.max(
      header.length,
      ...rows.map((row) => (row[i] || '').length)
    );
    return Math.min(maxContentWidth + 2, 30);
  });

  // Add width for selection indicator (2 chars: "▶ " or "  ")
  const indicatorWidth = 2;

  const renderCell = (content: string, width: number, isHeader: boolean, isSelected: boolean) => {
    const truncated = content.length > width - 2
      ? content.slice(0, width - 3) + '...'
      : content;
    const padded = truncated.padEnd(width);

    if (isHeader) {
      return (
        <Text bold color="cyan">
          {padded}
        </Text>
      );
    }

    if (isSelected) {
      return (
        <Text backgroundColor="cyan" color="black">
          {padded}
        </Text>
      );
    }

    return (
      <Text color="white">
        {padded}
      </Text>
    );
  };

  return (
    <Box flexDirection="column">
      {/* Header row */}
      <Box>
        {/* Empty space for indicator column */}
        <Box width={indicatorWidth}>
          <Text> </Text>
        </Box>
        {headers.map((header, i) => (
          <Box key={i} width={widths[i]}>
            {renderCell(header, widths[i], true, false)}
          </Box>
        ))}
      </Box>

      {/* Separator */}
      <Box>
        <Text color="gray">
          {' '.repeat(indicatorWidth)}{widths.map((w) => '-'.repeat(w)).join('')}
        </Text>
      </Box>

      {/* Data rows */}
      {rows.map((row, rowIndex) => {
        const isSelected = rowIndex === selectedIndex;
        const isHighlighted = isSelected && isFocused;
        return (
          <Box key={rowIndex}>
            {/* Selection indicator */}
            <Box width={indicatorWidth}>
              <Text color={isHighlighted ? 'cyan' : undefined}>
                {isHighlighted ? '▶ ' : '  '}
              </Text>
            </Box>
            {row.map((cell, cellIndex) => (
              <Box key={cellIndex} width={widths[cellIndex]}>
                {renderCell(cell, widths[cellIndex], false, isHighlighted)}
              </Box>
            ))}
          </Box>
        );
      })}

      {/* Hint text */}
      {hint && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>{hint}</Text>
        </Box>
      )}
    </Box>
  );
}
