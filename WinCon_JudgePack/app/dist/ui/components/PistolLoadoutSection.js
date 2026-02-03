import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import React, { useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Table } from './Table.js';
import { useStore } from '../context/store.js';
const SIDE_ORDER = {
    Attack: 0,
    Defense: 1,
};
function sortSides(sides) {
    return [...sides].sort((a, b) => SIDE_ORDER[a] - SIDE_ORDER[b]);
}
function formatLoadout(value) {
    return `$${value.toLocaleString()}`;
}
function formatWinRate(rate) {
    return `${(rate * 100).toFixed(0)}%`;
}
function renderLoadoutBar(value, maxValue, width = 20) {
    const ratio = maxValue > 0 ? value / maxValue : 0;
    const filled = Math.round(ratio * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
}
export function PistolLoadoutSection({ data }) {
    const commandMode = useStore((s) => s.commandMode);
    const [expanded, setExpanded] = useState(false);
    const [level, setLevel] = useState(0);
    const [mapIndex, setMapIndex] = useState(0);
    const [sideIndex, setSideIndex] = useState(0);
    const [matchIndex, setMatchIndex] = useState(0);
    // Extract unique maps
    const maps = useMemo(() => {
        const mapSet = new Set();
        for (const round of data.rounds) {
            mapSet.add(round.mapName);
        }
        return [...mapSet].sort();
    }, [data.rounds]);
    const selectedMap = maps[mapIndex] ?? null;
    // Get sides for selected map
    const sides = useMemo(() => {
        if (!selectedMap)
            return [];
        const sideSet = new Set();
        for (const round of data.rounds) {
            if (round.mapName === selectedMap) {
                sideSet.add(round.side);
            }
        }
        return sortSides([...sideSet]);
    }, [data.rounds, selectedMap]);
    const selectedSide = sides[sideIndex] ?? null;
    // Get rounds for selected map/side
    const rounds = useMemo(() => {
        if (!selectedMap || !selectedSide)
            return [];
        const key = `${selectedMap}|${selectedSide}`;
        return data.roundsByMapSide[key] ?? [];
    }, [data.roundsByMapSide, selectedMap, selectedSide]);
    const selectedRound = rounds[matchIndex] ?? null;
    // Reset indices when map/side changes
    React.useEffect(() => {
        setSideIndex(0);
        setMatchIndex(0);
    }, [selectedMap]);
    React.useEffect(() => {
        setMatchIndex(0);
    }, [selectedSide]);
    useInput((input, key) => {
        if (commandMode)
            return;
        if (input.toLowerCase() === 'u') {
            setExpanded((prev) => !prev);
            return;
        }
        if (!expanded)
            return;
        if (key.backspace || key.delete) {
            setLevel((prev) => Math.max(0, prev - 1));
            return;
        }
        if (key.return) {
            setLevel((prev) => Math.min(2, prev + 1));
            return;
        }
        if (key.upArrow || key.downArrow) {
            const dir = key.downArrow ? 1 : -1;
            if (level === 0 && maps.length > 0) {
                setMapIndex((prev) => (prev + dir + maps.length) % maps.length);
            }
            else if (level === 1 && sides.length > 0) {
                setSideIndex((prev) => (prev + dir + sides.length) % sides.length);
            }
            else if (level === 2 && rounds.length > 0) {
                setMatchIndex((prev) => (prev + dir + rounds.length) % rounds.length);
            }
        }
    }, { isActive: !commandMode });
    const summaryRows = useMemo(() => data.summary.map((row) => [
        row.map,
        row.side,
        String(row.roundCount),
        formatLoadout(row.avgLoadout),
        `${formatLoadout(row.minLoadout)}-${formatLoadout(row.maxLoadout)}`,
        `${row.wins}W-${row.losses}L (${formatWinRate(row.winRate)})`,
    ]), [data.summary]);
    // Find max loadout for histogram bars
    const maxHistogramCount = Math.max(...data.histogram.map(b => b.count), 1);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsxs(Text, { color: "cyan", children: [expanded ? 'v' : '>', " "] }), _jsxs(Text, { color: "gray", children: ["Press ", _jsx(Text, { color: "yellow", children: "U" }), " to ", expanded ? 'collapse' : 'expand'] })] }), expanded && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Box, { marginBottom: 1, children: _jsxs(Text, { children: [_jsx(Text, { color: "gray", children: "Pistol Rounds: " }), _jsx(Text, { bold: true, children: data.meta.totalRounds }), _jsx(Text, { color: "gray", children: " | Avg Loadout: " }), _jsx(Text, { bold: true, children: formatLoadout(data.meta.avgLoadout) }), _jsx(Text, { color: "gray", children: " | Win Rate: " }), _jsx(Text, { bold: true, color: data.meta.overallWinRate >= 0.5 ? 'green' : 'red', children: formatWinRate(data.meta.overallWinRate) })] }) }), _jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { bold: true, children: "By Map & Side" }), summaryRows.length === 0 ? (_jsx(Text, { color: "gray", children: "No pistol round data available." })) : (_jsx(Table, { headers: ['Map', 'Side', 'Rounds', 'Avg Loadout', 'Range', 'Record'], rows: summaryRows }))] }), _jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { bold: true, children: "Loadout Distribution" }), data.histogram.map((bucket) => (_jsxs(Box, { children: [_jsx(Text, { color: "gray", children: bucket.range.padEnd(12) }), _jsx(Text, { color: "cyan", children: renderLoadoutBar(bucket.count, maxHistogramCount, 15) }), _jsxs(Text, { children: [" ", String(bucket.count).padStart(2), " "] }), _jsxs(Text, { color: bucket.winRate >= 0.5 ? 'green' : 'red', children: ["(", formatWinRate(bucket.winRate), " WR)"] })] }, bucket.range)))] }), _jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { bold: true, children: "Drill-down" }), maps.length === 0 ? (_jsx(Text, { color: "gray", children: "No map data available." })) : (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "gray", children: "Map" }), maps.map((map, idx) => (_jsxs(Box, { children: [_jsx(Text, { color: level === 0 && idx === mapIndex ? 'cyan' : 'gray', children: level === 0 && idx === mapIndex ? '> ' : '  ' }), _jsx(Text, { bold: level === 0 && idx === mapIndex, children: map })] }, `map-${map}`))), selectedMap && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "gray", children: "Side" }), sides.length === 0 ? (_jsx(Text, { color: "gray", children: "No side data." })) : (sides.map((side, idx) => (_jsxs(Box, { children: [_jsx(Text, { color: level === 1 && idx === sideIndex ? 'cyan' : 'gray', children: level === 1 && idx === sideIndex ? '> ' : '  ' }), _jsx(Text, { bold: level === 1 && idx === sideIndex, children: side })] }, `side-${side}`))))] })), selectedSide && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "gray", children: "Match (Pistol Round)" }), rounds.length === 0 ? (_jsx(Text, { color: "gray", children: "No matches available." })) : (rounds.map((round, idx) => (_jsxs(Box, { children: [_jsx(Text, { color: level === 2 && idx === matchIndex ? 'cyan' : 'gray', children: level === 2 && idx === matchIndex ? '> ' : '  ' }), _jsxs(Text, { bold: level === 2 && idx === matchIndex, children: [round.matchDate, " vs ", round.opponentName, round.roundNumber === 13 ? ' (R13)' : ''] })] }, `match-${round.matchId}-${round.roundNumber}`))))] })), selectedRound && (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 1, children: [_jsxs(Text, { color: "gray", children: [selectedRound.teamName, " | ", selectedRound.mapName, " | ", selectedRound.side, " | Round ", selectedRound.roundNumber] }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { children: [_jsx(Text, { color: "gray", children: "Team Loadout: " }), _jsx(Text, { bold: true, children: formatLoadout(selectedRound.teamLoadout) }), _jsx(Text, { color: "gray", children: " | Opponent: " }), _jsx(Text, { children: formatLoadout(selectedRound.opponentLoadout) }), _jsx(Text, { color: "gray", children: " | Result: " }), _jsx(Text, { bold: true, color: selectedRound.won ? 'green' : 'red', children: selectedRound.won ? 'WIN' : 'LOSS' })] }) }), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: "gray", children: "Agents: " }), _jsx(Text, { children: selectedRound.agents.join(', ') })] })] }))] })), _jsxs(Text, { color: "gray", dimColor: true, children: ['Up/Down', " Navigate  ", 'Enter', " Select  ", 'Backspace', " Back  ", 'U', " Toggle"] })] })] }))] }));
}
