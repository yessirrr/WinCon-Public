import React from 'react';
import { Box, Text } from 'ink';
import { Table, MomentumSection, EconIntelSection, CollapsibleTextSection } from '../components/index.js';
import type { EconIntelData } from '../components/index.js';
import type { RoundOutcomeReport } from '../../analysis/roundOutcome.js';
import { useStore } from '../context/store.js';
import type { Report, ReportSection, ReportContent } from '../../data/models/index.js';

export function ReportViewScreen(): React.ReactElement {
  const report = useStore((s) => s.currentReport);

  if (!report) {
    return (
      <Box padding={1}>
        <Text color="gray">No report loaded. Use /pistol or /overview to generate a report.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Report Header */}
      <Box marginBottom={1} flexDirection="column">
        <Text bold color="cyan">{report.title}</Text>
        <Box>
          <Text color="gray">
            {report.entityType === 'team' ? 'Team' : 'Player'}:{' '}
          </Text>
          <Text>{report.entityName}</Text>
        </Box>
        <Box>
          <Text color="gray">Generated: </Text>
          <Text>{new Date(report.generatedAt).toLocaleString()}</Text>
        </Box>
        {report.filters && (
          <Box>
            <Text color="gray">Filters: </Text>
            <Text>
              {[
                report.filters.window && `Last ${report.filters.window} matches`,
                report.filters.map && `Map: ${report.filters.map}`,
                report.filters.side && report.filters.side !== 'both' && `Side: ${report.filters.side}`,
              ]
                .filter(Boolean)
                .join(' | ') || 'None'}
            </Text>
          </Box>
        )}
      </Box>

      {/* Report Sections */}
      {report.sections.map((section, i) => (
        <Box key={i} flexDirection="column" marginBottom={1}>
          <Text bold color="yellow">{section.heading}</Text>
          <Box marginTop={0}>
          <RenderContent content={section.content} heading={section.heading} />
          </Box>
        </Box>
      ))}

      {/* Footer */}
      <Box marginTop={1}>
        <Text color="gray">Use /export to save this report as markdown</Text>
      </Box>
    </Box>
  );
}

function RenderContent({ content, heading }: { content: ReportContent; heading: string }): React.ReactElement {
  const renderFormattedText = (value: string): React.ReactElement => {
    const lines = value.split('\n');
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

  switch (content.type) {
    case 'text':
      if (heading === 'Win Condition Summary (W)') {
        return (
          <CollapsibleTextSection
            value={content.value}
            hotkey="w"
            label="win condition summary"
          />
        );
      }
      return renderFormattedText(content.value);

    case 'bullets':
      return (
        <Box flexDirection="column">
          {content.items.map((item, i) => (
            <Text key={i}>  * {item}</Text>
          ))}
        </Box>
      );

    case 'table':
      return <Table headers={content.headers} rows={content.rows} />;

    case 'stat':
      return (
        <Box>
          <Text color="gray">{content.label}: </Text>
          <Text bold color="green">{content.value}</Text>
          {content.unit && <Text color="gray"> {content.unit}</Text>}
        </Box>
      );

    case 'momentum':
      return <MomentumSection data={content.data as RoundOutcomeReport} />;

    case 'econ-intel':
      return <EconIntelSection data={content.data as EconIntelData} />;


    default:
      return <Text color="red">Unknown content type</Text>;
  }
}
