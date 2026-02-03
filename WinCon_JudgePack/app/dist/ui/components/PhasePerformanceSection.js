import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Table } from './Table.js';
import { useStore } from '../context/store.js';
function formatRate(rate, unavailable) {
    if (unavailable)
        return '--';
    if (rate.rounds === 0)
        return '-- (0)';
    const pct = rate.pct === null ? '--' : `${(rate.pct * 100).toFixed(1)}%`;
    return `${pct} (${rate.wins}/${rate.rounds})`;
}
function formatMedian(seconds, unavailable) {
    if (unavailable || seconds === null)
        return '--';
    return `${Math.round(seconds)}s`;
}
function formatDebugLabel(label, value) {
    return (_jsxs(Text, { children: [_jsxs(Text, { color: "gray", children: [label, ": "] }), _jsx(Text, { children: value })] }));
}
export function PhasePerformanceSection({ data }) {
    const commandMode = useStore((s) => s.commandMode);
    const [expanded, setExpanded] = useState(false);
    const showDebug = process.env.WINCON_DEBUG === '1';
    const unavailable = data.available === false;
    useInput((input) => {
        if (commandMode)
            return;
        if (input.toLowerCase() === 'p') {
            setExpanded((prev) => !prev);
        }
    });
    const byMapRows = Object.entries(data.byMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([mapName, stats]) => ([
        mapName,
        formatRate(stats.attackPostPlant, unavailable),
        formatRate(stats.defenseRetake, unavailable),
        formatMedian(stats.medianPlantTimeSec, unavailable),
    ]));
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsxs(Text, { color: "cyan", children: [expanded ? 'v' : '>', " "] }), _jsxs(Text, { color: "gray", children: ["Press ", _jsx(Text, { color: "yellow", children: "P" }), " to ", expanded ? 'collapse' : 'expand', " phase performance"] })] }), expanded && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Box, { marginBottom: 1, flexDirection: "column", children: [_jsx(Text, { bold: true, children: "Overall" }), _jsx(Table, { headers: ['Metric', 'Value'], rows: [
                                    ['Attack Post-Plant Win%', formatRate(data.overall.attackPostPlant, unavailable)],
                                    ['Defense Retake Win%', formatRate(data.overall.defenseRetake, unavailable)],
                                    ['Median Plant Time (Attack)', formatMedian(data.overall.medianPlantTimeSec, unavailable)],
                                ] })] }), _jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, children: "By Map" }), _jsx(Table, { headers: ['Map', 'Attack Post-Plant', 'Defense Retake', 'Med Plant Time'], rows: unavailable ? [['No round-level data', '--', '--', '--']] : (byMapRows.length > 0 ? byMapRows : [['No data', '--', '--', '--']]) })] }), showDebug && data.debug && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "gray", children: "Phase Performance Debug Counters" }), unavailable && _jsx(Text, { color: "gray", children: "round-level data unavailable (no segments)" }), formatDebugLabel('totalRoundsSeen', data.debug.totalRoundsSeen), formatDebugLabel('roundsWithPlantEvent', data.debug.roundsWithPlantEvent), formatDebugLabel('roundsWhereWinnerKnown', data.debug.roundsWhereWinnerKnown), formatDebugLabel('roundsWhereSideAttackForTeam', data.debug.roundsWhereSideAttackForTeam), formatDebugLabel('roundsWhereSideDefenseForTeam', data.debug.roundsWhereSideDefenseForTeam), formatDebugLabel('roundsCountedAttackPostPlantDenom', data.debug.roundsCountedAttackPostPlantDenom), formatDebugLabel('roundsCountedDefenseRetakeDenom', data.debug.roundsCountedDefenseRetakeDenom)] }))] }))] }));
}
