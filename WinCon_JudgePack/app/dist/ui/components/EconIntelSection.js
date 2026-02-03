import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Table } from './Table.js';
import { useStore } from '../context/store.js';
// ============================================================================
// Helpers
// ============================================================================
function formatPctDecimal(value) {
    return `${(value * 100).toFixed(0)}%`;
}
function getPauseScoreColor(score) {
    if (score >= 70)
        return 'red';
    if (score >= 50)
        return 'yellow';
    return 'gray';
}
// ============================================================================
// Component
// ============================================================================
export function EconIntelSection({ data }) {
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
        return (_jsx(Box, { flexDirection: "column", children: _jsx(Text, { color: "gray", children: "No economy data available." }) }));
    }
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsxs(Text, { color: "cyan", children: [expanded ? 'v' : '>', " "] }), _jsxs(Text, { color: "gray", children: ["Press ", _jsx(Text, { color: "yellow", children: "E" }), " to ", expanded ? 'collapse' : 'expand', " economy intel"] })] }), expanded && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Box, { marginBottom: 1, flexDirection: "column", children: [_jsx(Text, { bold: true, children: "Aggregated Economy (all maps)" }), _jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Avg Confidence: " }), _jsx(Text, { children: formatPctDecimal(data.aggregated.avgEconConfidence) }), _jsx(Text, { color: "gray", children: " | ECO: " }), _jsx(Text, { children: formatPctDecimal(data.aggregated.buyDistribution.ECO) }), _jsx(Text, { color: "gray", children: " | HALF: " }), _jsx(Text, { children: formatPctDecimal(data.aggregated.buyDistribution.HALF_BUY) }), _jsx(Text, { color: "gray", children: " | FULL: " }), _jsx(Text, { children: formatPctDecimal(data.aggregated.buyDistribution.FULL_BUY) })] }), _jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Econ States - BROKE: " }), _jsx(Text, { color: "red", children: formatPctDecimal(data.aggregated.econDistribution.BROKE) }), _jsx(Text, { color: "gray", children: " | LOW: " }), _jsx(Text, { color: "yellow", children: formatPctDecimal(data.aggregated.econDistribution.LOW) }), _jsx(Text, { color: "gray", children: " | OK: " }), _jsx(Text, { children: formatPctDecimal(data.aggregated.econDistribution.OK) }), _jsx(Text, { color: "gray", children: " | RICH: " }), _jsx(Text, { color: "green", children: formatPctDecimal(data.aggregated.econDistribution.RICH) })] })] }), _jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { color: "gray", children: "Map: " }), maps.map((m, idx) => (_jsx(Box, { marginRight: 1, children: _jsxs(Text, { color: idx === selectedMap ? 'cyan' : 'gray', bold: idx === selectedMap, children: ["[", idx + 1, "] ", m.mapName] }) }, m.mapName)))] }), _jsx(Text, { color: "gray", dimColor: true, children: "Left/Right arrows to switch maps" }), currentMap && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Box, { marginBottom: 1, flexDirection: "column", children: [_jsxs(Text, { bold: true, color: "yellow", children: ["Side Win Rates - ", currentMap.mapName] }), _jsx(Table, { headers: ['Side', 'Win Rate', 'Rounds'], rows: [
                                            ['Attack', formatPctDecimal(currentMap.sideWinRates.attack), String(currentMap.sideWinRates.attackRounds)],
                                            ['Defense', formatPctDecimal(currentMap.sideWinRates.defense), String(currentMap.sideWinRates.defenseRounds)],
                                        ] })] }), _jsxs(Box, { marginBottom: 1, flexDirection: "column", children: [_jsx(Text, { bold: true, color: "yellow", children: "Round Type Win Rates" }), _jsx(Table, { headers: ['Round Type', 'Win Rate', 'Played'], rows: [
                                            ['Pistol (R1, R12)', formatPctDecimal(currentMap.roundTypeWinRates.pistol), String(currentMap.roundTypeWinRates.pistolPlayed)],
                                            ['Post-Pistol (R2, R13)', formatPctDecimal(currentMap.roundTypeWinRates.postPistol), String(currentMap.roundTypeWinRates.postPistolPlayed)],
                                        ] })] }), _jsxs(Box, { marginBottom: 1, flexDirection: "column", children: [_jsx(Text, { bold: true, color: "yellow", children: "Inferred Economy Distribution" }), _jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Buy: " }), _jsxs(Text, { children: ["ECO ", formatPctDecimal(currentMap.econ.buyDistribution.ECO)] }), _jsx(Text, { color: "gray", children: " | " }), _jsxs(Text, { children: ["HALF ", formatPctDecimal(currentMap.econ.buyDistribution.HALF_BUY)] }), _jsx(Text, { color: "gray", children: " | " }), _jsxs(Text, { children: ["FULL ", formatPctDecimal(currentMap.econ.buyDistribution.FULL_BUY)] })] }), _jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "State: " }), _jsxs(Text, { color: "red", children: ["BROKE ", formatPctDecimal(currentMap.econ.econDistribution.BROKE)] }), _jsx(Text, { color: "gray", children: " | " }), _jsxs(Text, { color: "yellow", children: ["LOW ", formatPctDecimal(currentMap.econ.econDistribution.LOW)] }), _jsx(Text, { color: "gray", children: " | " }), _jsxs(Text, { children: ["OK ", formatPctDecimal(currentMap.econ.econDistribution.OK)] }), _jsx(Text, { color: "gray", children: " | " }), _jsxs(Text, { color: "green", children: ["RICH ", formatPctDecimal(currentMap.econ.econDistribution.RICH)] })] }), _jsx(Text, { color: "gray", dimColor: true, children: "* Inferred from outcomes, not actual credits" })] }), _jsxs(Box, { marginBottom: 1, flexDirection: "column", children: [_jsx(Text, { bold: true, color: "yellow", children: "Pause Windows (Decision Support)" }), currentMap.pause.topRecommendations.length === 0 ? (_jsx(Text, { color: "gray", children: "No high-value pause windows identified." })) : (_jsx(Box, { flexDirection: "column", children: currentMap.pause.topRecommendations.map((pw, idx) => (_jsxs(Box, { children: [_jsxs(Text, { color: getPauseScoreColor(pw.pauseScore), children: [idx + 1, ". Before R", pw.beforeRound] }), _jsxs(Text, { color: "gray", children: [" (", pw.scoreContext, ") "] }), _jsxs(Text, { bold: true, color: getPauseScoreColor(pw.pauseScore), children: ["Score: ", pw.pauseScore] }), _jsxs(Text, { color: "gray", children: [" - ", pw.reason] })] }, `pause-${pw.beforeRound}`))) })), _jsx(Text, { color: "gray", dimColor: true, children: "* Pause recommendations are decision support, not predictions" })] })] }))] }))] }));
}
