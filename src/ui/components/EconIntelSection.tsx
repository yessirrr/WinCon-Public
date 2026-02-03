import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Table } from './Table.js';
import { useStore } from '../context/store.js';
import type { MapEconSummary, BuyClass, EconState } from '../../domain/econInference.js';
import type { MapPauseAnalysis } from '../../domain/pauseModel.js';

// ============================================================================
// Types
// ============================================================================

export interface EconIntelData {
  mapSummaries: Array<{
    mapName: string;
    econ: MapEconSummary;
    pause: MapPauseAnalysis;
    sideWinRates: {
      attack: number;
      defense: number;
      attackRounds: number;
      defenseRounds: number;
    };
    roundTypeWinRates: {
      pistol: number;
      pistolPlayed: number;
      postPistol: number;
      postPistolPlayed: number;
    };
  }>;
  aggregated: {
    avgEconConfidence: number;
    econDistribution: Record<EconState, number>;
    buyDistribution: Record<BuyClass, number>;
  };
}

interface EconIntelSectionProps {
  data: EconIntelData;
}

// ============================================================================
// Helpers
// ============================================================================

function formatPctDecimal(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function getPauseScoreColor(score: number): string {
  if (score >= 70) return 'red';
  if (score >= 50) return 'yellow';
  return 'gray';
}

// ============================================================================
// Component
// ============================================================================

export function EconIntelSection({ data }: EconIntelSectionProps): React.ReactElement {
  const commandMode = useStore((s) => s.commandMode);
  const expanded = useStore((s) => s.econExpanded);
  const toggleEcon = useStore((s) => s.toggleEcon);
  const [selectedMap, setSelectedMap] = useState(0);

  const maps = data.mapSummaries;
  const currentMap = maps[selectedMap] ?? null;

  useInput((input) => {
    if (input.toLowerCase() === 'e') {
      toggleEcon();
    }
  }, { isActive: !commandMode });

  useInput((_, key) => {
    if (key.leftArrow || key.rightArrow) {
      const dir = key.rightArrow ? 1 : -1;
      setSelectedMap((prev) => (prev + dir + maps.length) % maps.length);
    }
  }, { isActive: !commandMode && expanded && maps.length > 0 });

  if (maps.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="gray">No economy data available.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan">{expanded ? 'v' : '>'} </Text>
        <Text color="gray">
          Press <Text color="yellow">E</Text> to {expanded ? 'collapse' : 'expand'} economy intel
        </Text>
      </Box>

      {expanded && (
        <Box flexDirection="column" marginTop={1}>
          {/* Aggregated Summary */}
          <Box marginBottom={1} flexDirection="column">
            <Text bold>Aggregated Economy (all maps)</Text>
            <Box>
              <Text color="gray">Avg Confidence: </Text>
              <Text>{formatPctDecimal(data.aggregated.avgEconConfidence)}</Text>
              <Text color="gray"> | ECO: </Text>
              <Text>{formatPctDecimal(data.aggregated.buyDistribution.ECO)}</Text>
              <Text color="gray"> | HALF: </Text>
              <Text>{formatPctDecimal(data.aggregated.buyDistribution.HALF_BUY)}</Text>
              <Text color="gray"> | FULL: </Text>
              <Text>{formatPctDecimal(data.aggregated.buyDistribution.FULL_BUY)}</Text>
            </Box>
            <Box>
              <Text color="gray">Econ States - BROKE: </Text>
              <Text color="red">{formatPctDecimal(data.aggregated.econDistribution.BROKE)}</Text>
              <Text color="gray"> | LOW: </Text>
              <Text color="yellow">{formatPctDecimal(data.aggregated.econDistribution.LOW)}</Text>
              <Text color="gray"> | OK: </Text>
              <Text>{formatPctDecimal(data.aggregated.econDistribution.OK)}</Text>
              <Text color="gray"> | RICH: </Text>
              <Text color="green">{formatPctDecimal(data.aggregated.econDistribution.RICH)}</Text>
            </Box>
          </Box>

          {/* Map Selector */}
          <Box marginBottom={1}>
            <Text color="gray">Map: </Text>
            {maps.map((m, idx) => (
              <Box key={m.mapName} marginRight={1}>
                <Text
                  color={idx === selectedMap ? 'cyan' : 'gray'}
                  bold={idx === selectedMap}
                >
                  [{idx + 1}] {m.mapName}
                </Text>
              </Box>
            ))}
          </Box>
          <Text color="gray" dimColor>Left/Right arrows to switch maps</Text>

          {currentMap && (
            <Box flexDirection="column" marginTop={1}>
              {/* Side Win Rates */}
              <Box marginBottom={1} flexDirection="column">
                <Text bold color="yellow">Side Win Rates - {currentMap.mapName}</Text>
                <Table
                  headers={['Side', 'Win Rate', 'Rounds']}
                  rows={[
                    ['Attack', formatPctDecimal(currentMap.sideWinRates.attack), String(currentMap.sideWinRates.attackRounds)],
                    ['Defense', formatPctDecimal(currentMap.sideWinRates.defense), String(currentMap.sideWinRates.defenseRounds)],
                  ]}
                />
              </Box>

              {/* Round Type Win Rates */}
              <Box marginBottom={1} flexDirection="column">
                <Text bold color="yellow">Round Type Win Rates</Text>
                <Table
                  headers={['Round Type', 'Win Rate', 'Played']}
                  rows={[
                    ['Pistol (R1, R12)', formatPctDecimal(currentMap.roundTypeWinRates.pistol), String(currentMap.roundTypeWinRates.pistolPlayed)],
                    ['Post-Pistol (R2, R13)', formatPctDecimal(currentMap.roundTypeWinRates.postPistol), String(currentMap.roundTypeWinRates.postPistolPlayed)],
                  ]}
                />
              </Box>

              {/* Economy Distribution */}
              <Box marginBottom={1} flexDirection="column">
                <Text bold color="yellow">Inferred Economy Distribution</Text>
                <Box>
                  <Text color="gray">Buy: </Text>
                  <Text>ECO {formatPctDecimal(currentMap.econ.buyDistribution.ECO)}</Text>
                  <Text color="gray"> | </Text>
                  <Text>HALF {formatPctDecimal(currentMap.econ.buyDistribution.HALF_BUY)}</Text>
                  <Text color="gray"> | </Text>
                  <Text>FULL {formatPctDecimal(currentMap.econ.buyDistribution.FULL_BUY)}</Text>
                </Box>
                <Box>
                  <Text color="gray">State: </Text>
                  <Text color="red">BROKE {formatPctDecimal(currentMap.econ.econDistribution.BROKE)}</Text>
                  <Text color="gray"> | </Text>
                  <Text color="yellow">LOW {formatPctDecimal(currentMap.econ.econDistribution.LOW)}</Text>
                  <Text color="gray"> | </Text>
                  <Text>OK {formatPctDecimal(currentMap.econ.econDistribution.OK)}</Text>
                  <Text color="gray"> | </Text>
                  <Text color="green">RICH {formatPctDecimal(currentMap.econ.econDistribution.RICH)}</Text>
                </Box>
                <Text color="gray" dimColor>* Inferred from outcomes, not actual credits</Text>
              </Box>

              {/* Pause Recommendations */}
              <Box marginBottom={1} flexDirection="column">
                <Text bold color="yellow">Pause Windows (Decision Support)</Text>
                {currentMap.pause.topRecommendations.length === 0 ? (
                  <Text color="gray">No high-value pause windows identified.</Text>
                ) : (
                  <Box flexDirection="column">
                    {currentMap.pause.topRecommendations.map((pw, idx) => (
                      <Box key={`pause-${pw.beforeRound}`}>
                        <Text color={getPauseScoreColor(pw.pauseScore)}>
                          {idx + 1}. Before R{pw.beforeRound}
                        </Text>
                        <Text color="gray"> ({pw.scoreContext}) </Text>
                        <Text bold color={getPauseScoreColor(pw.pauseScore)}>
                          Score: {pw.pauseScore}
                        </Text>
                        <Text color="gray"> - {pw.reason}</Text>
                      </Box>
                    ))}
                  </Box>
                )}
                <Text color="gray" dimColor>* Pause recommendations are decision support, not predictions</Text>
              </Box>

            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
