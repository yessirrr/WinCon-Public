import React from 'react';
import { Box, Text } from 'ink';

interface TableProps {
  headers: string[];
  rows: string[][];
  columnWidths?: number[];
}

export function Table({ headers, rows, columnWidths }: TableProps): React.ReactElement {
  // Calculate column widths if not provided
  const widths = columnWidths || headers.map((header, i) => {
    const maxContentWidth = Math.max(
      header.length,
      ...rows.map((row) => (row[i] || '').length)
    );
    return Math.min(maxContentWidth + 2, 30);
  });

  const renderCell = (content: string, width: number, isHeader: boolean) => {
    const truncated = content.length > width - 2
      ? content.slice(0, width - 3) + '...'
      : content;
    const padded = truncated.padEnd(width);

    return (
      <Text bold={isHeader} color={isHeader ? 'cyan' : 'white'}>
        {padded}
      </Text>
    );
  };

  return (
    <Box flexDirection="column">
      {/* Header row */}
      <Box>
        {headers.map((header, i) => (
          <Box key={i} width={widths[i]}>
            {renderCell(header, widths[i], true)}
          </Box>
        ))}
      </Box>

      {/* Separator */}
      <Box>
        <Text color="gray">
          {widths.map((w) => '-'.repeat(w)).join('')}
        </Text>
      </Box>

      {/* Data rows */}
      {rows.map((row, rowIndex) => (
        <Box key={rowIndex}>
          {row.map((cell, cellIndex) => (
            <Box key={cellIndex} width={widths[cellIndex]}>
              {renderCell(cell, widths[cellIndex], false)}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
