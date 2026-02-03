import React, { useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Table } from './Table.js';
import { useStore } from '../context/store.js';
import type { RoundOutcomeReport, HeatZone } from '../../analysis/roundOutcome.js';

interface MomentumSectionProps {
  data: RoundOutcomeReport;
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`;
}

function formatPercentDetailed(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function renderBar(value: number, maxValue: number = 1, width: number = 10): string {
  const ratio = maxValue > 0 ? Math.min(value / maxValue, 1) : 0;
  const filled = Math.round(ratio * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function getSignificanceColor(significance: HeatZone['significance']): string {
  switch (significance) {
    case 'high': return 'yellow';
    case 'medium': return 'white';
    case 'low': return 'gray';
  }
}

type TabName = 'overview' | 'pistol' | 'streaks' | 'heat';

export function MomentumSection({ data }: MomentumSectionProps): React.ReactElement {
  const commandMode = useStore((s) => s.commandMode);
  const expanded = useStore((s) => s.momentumExpanded);
  const toggleMomentum = useStore((s) => s.toggleMomentum);
  const [activeTab, setActiveTab] = useState<TabName>('overview');

  const tabs: TabName[] = ['overview', 'pistol', 'streaks', 'heat'];

  useInput((input) => {
    if (input.toLowerCase() === 'm') {
      toggleMomentum();
    }
  }, { isActive: !commandMode });

  useInput((_, key) => {
    if (key.leftArrow || key.rightArrow) {
      const dir = key.rightArrow ? 1 : -1;
      const currentIndex = tabs.indexOf(activeTab);
      const newIndex = (currentIndex + dir + tabs.length) % tabs.length;
      setActiveTab(tabs[newIndex]);
    }
  }, { isActive: !commandMode && expanded });

  // Prepare data for tables
  const sideRows = useMemo(() =>
    data.sidePerformance.map((sp) => [
      sp.map,
      `${sp.attackRoundsWon}/${sp.attackRoundsPlayed}`,
      formatPercent(sp.attackWinRate),
      `${sp.defenseRoundsWon}/${sp.defenseRoundsPlayed}`,
      formatPercent(sp.defenseWinRate),
      sp.strongerSide,
    ]),
    [data.sidePerformance]
  );

  const pistolRows = useMemo(() =>
    data.pistolPerformance.map((pp) => [
      pp.map,
      `${pp.pistolRoundsWon}/${pp.pistolRoundsPlayed}`,
      formatPercent(pp.pistolWinRate),
      formatPercent(pp.attackPistolWinRate),
      formatPercent(pp.defensePistolWinRate),
      formatPercent(pp.mapWinRateGivenPistolWin),
      formatPercent(pp.mapWinRateGivenPistolLoss),
    ]),
    [data.pistolPerformance]
  );

  const postPistolRows = useMemo(() =>
    data.postPistolPerformance.map((pp) => [
      pp.map,
      formatPercent(pp.postPistolWinRate),
      formatPercent(pp.postPistolWinRateAfterPistolWin),
      formatPercent(pp.forceBreakRate),
      `${pp.pistolWinThenPostPistolWin}/${pp.pistolWinThenPostPistolWin + pp.pistolWinThenPostPistolLoss}`,
      `${pp.pistolLossThenPostPistolWin}/${pp.pistolLossThenPostPistolWin + pp.pistolLossThenPostPistolLoss}`,
    ]),
    [data.postPistolPerformance]
  );

  const streakRows = useMemo(() =>
    data.streakStats.map((ss) => [
      ss.map,
      String(ss.maxStreak),
      ss.avgStreakLength.toFixed(1),
      String(ss.twoRoundStreaks),
      String(ss.threeRoundStreaks),
      String(ss.fourPlusStreaks),
    ]),
    [data.streakStats]
  );

  const continuationRows = useMemo(() =>
    data.streakContinuation.map((sc) => [
      sc.map,
      `${formatPercent(sc.winAfter1Win)} (${sc.winAfter1WinSamples})`,
      `${formatPercent(sc.winAfter2Wins)} (${sc.winAfter2WinsSamples})`,
      `${formatPercent(sc.winAfter3Wins)} (${sc.winAfter3WinsSamples})`,
    ]),
    [data.streakContinuation]
  );

  const conditionalRows = useMemo(() =>
    data.conditionalSignals.map((cs) => [
      cs.map,
      `${formatPercent(cs.mapWinRateGivenPistolWin)} (${cs.samples.pistolWins})`,
      `${formatPercent(cs.mapWinRateGivenPostPistolWin)} (${cs.samples.postPistolWins})`,
      `${formatPercent(cs.mapWinRateGivenEarlyStreak)} (${cs.samples.earlyStreaks})`,
    ]),
    [data.conditionalSignals]
  );

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan">{expanded ? 'v' : '>'} </Text>
        <Text color="gray">
          Press <Text color="yellow">M</Text> to {expanded ? 'collapse' : 'expand'} momentum analysis
        </Text>
      </Box>

      {expanded && (
        <Box flexDirection="column" marginTop={1}>
          {/* Aggregated Summary */}
          <Box marginBottom={1} flexDirection="column">
            <Text bold>Aggregated ({data.aggregated.totalMaps} maps)</Text>
            <Box>
              <Text color="gray">Round WR: </Text>
              <Text bold>{formatPercent(data.aggregated.overallWinRate)}</Text>
              <Text color="gray"> | Pistol WR: </Text>
              <Text bold>{formatPercent(data.aggregated.overallPistolWinRate)}</Text>
              <Text color="gray"> | Attack WR: </Text>
              <Text bold color={data.aggregated.overallAttackWinRate >= 0.5 ? 'green' : 'red'}>
                {formatPercent(data.aggregated.overallAttackWinRate)}
              </Text>
              <Text color="gray"> | Defense WR: </Text>
              <Text bold color={data.aggregated.overallDefenseWinRate >= 0.5 ? 'green' : 'red'}>
                {formatPercent(data.aggregated.overallDefenseWinRate)}
              </Text>
            </Box>
          </Box>

          {/* Tabs */}
          <Box marginBottom={1}>
            {tabs.map((tab, idx) => (
              <Box key={tab} marginRight={2}>
                <Text
                  color={activeTab === tab ? 'cyan' : 'gray'}
                  bold={activeTab === tab}
                >
                  [{idx + 1}] {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </Box>
            ))}
          </Box>
          <Text color="gray" dimColor>Left/Right arrows to switch tabs</Text>

          {/* Tab Content */}
          <Box flexDirection="column" marginTop={1}>
            {activeTab === 'overview' && (
              <Box flexDirection="column">
                <Text bold color="yellow">Side Performance</Text>
                {sideRows.length === 0 ? (
                  <Text color="gray">No data available.</Text>
                ) : (
                  <Table
                    headers={['Map', 'Atk W/P', 'Atk WR', 'Def W/P', 'Def WR', 'Stronger']}
                    rows={sideRows}
                  />
                )}

                <Box marginTop={1}>
                  <Text bold color="yellow">Map Win Signals</Text>
                </Box>
                {conditionalRows.length === 0 ? (
                  <Text color="gray">No data available.</Text>
                ) : (
                  <Table
                    headers={['Map', 'WR|Pistol Win', 'WR|Post-Pistol Win', 'WR|Early Streak']}
                    rows={conditionalRows}
                  />
                )}
              </Box>
            )}

            {activeTab === 'pistol' && (
              <Box flexDirection="column">
                <Text bold color="yellow">Pistol Round Performance</Text>
                {pistolRows.length === 0 ? (
                  <Text color="gray">No data available.</Text>
                ) : (
                  <Table
                    headers={['Map', 'W/P', 'WR', 'Atk WR', 'Def WR', 'Map WR|Win', 'Map WR|Loss']}
                    rows={pistolRows}
                  />
                )}

                <Box marginTop={1}>
                  <Text bold color="yellow">Post-Pistol (R2/R14) Performance</Text>
                </Box>
                {postPistolRows.length === 0 ? (
                  <Text color="gray">No data available.</Text>
                ) : (
                  <Table
                    headers={['Map', 'Post WR', 'After P Win', 'Force Break', 'P Win->Post', 'P Loss->Post']}
                    rows={postPistolRows}
                  />
                )}
              </Box>
            )}

            {activeTab === 'streaks' && (
              <Box flexDirection="column">
                <Text bold color="yellow">Win Streak Analysis</Text>
                {streakRows.length === 0 ? (
                  <Text color="gray">No data available.</Text>
                ) : (
                  <Table
                    headers={['Map', 'Max', 'Avg', '2-Round', '3-Round', '4+ Round']}
                    rows={streakRows}
                  />
                )}

                <Box marginTop={1}>
                  <Text bold color="yellow">Streak Continuation P(win next | streak)</Text>
                </Box>
                {continuationRows.length === 0 ? (
                  <Text color="gray">No data available.</Text>
                ) : (
                  <Table
                    headers={['Map', 'After 1 Win', 'After 2 Wins', 'After 3 Wins']}
                    rows={continuationRows}
                  />
                )}
              </Box>
            )}

            {activeTab === 'heat' && (
              <Box flexDirection="column">
                <Text bold color="yellow">Heat Zones (Round Ranges)</Text>
                {data.heatZones.length === 0 ? (
                  <Text color="gray">No data available.</Text>
                ) : (
                  <Box flexDirection="column">
                    {data.heatZones.map((hz) => (
                      <Box key={hz.roundRange} marginBottom={0}>
                        <Text color={getSignificanceColor(hz.significance)}>
                          {hz.roundRange.padEnd(18)}
                        </Text>
                        <Text color="cyan">{renderBar(hz.winRate, 1, 12)}</Text>
                        <Text> {formatPercentDetailed(hz.winRate).padStart(6)} WR </Text>
                        <Text color="gray">| Streak Start: {formatPercent(hz.streakStartRate).padStart(4)} </Text>
                        <Text color="gray">| Streak End: {formatPercent(hz.streakEndRate).padStart(4)}</Text>
                      </Box>
                    ))}
                    <Box marginTop={1}>
                      <Text color="gray">
                        Significance: <Text color="yellow">High</Text> (yellow) |{' '}
                        <Text color="white">Medium</Text> (white) |{' '}
                        <Text color="gray">Low</Text> (gray)
                      </Text>
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
