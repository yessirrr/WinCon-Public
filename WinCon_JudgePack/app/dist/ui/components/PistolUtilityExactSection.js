import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Table } from './Table.js';
import { useStore } from '../context/store.js';
const SIDE_ORDER = {
    Attack: 0,
    Defense: 1,
    Unknown: 2,
};
function sortSides(sides) {
    return [...sides].sort((a, b) => SIDE_ORDER[a] - SIDE_ORDER[b]);
}
function formatAbilityList(abilities) {
    if (!abilities || abilities.length === 0)
        return 'No Abilities';
    return abilities
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((ability) => `${ability.name} x${ability.charges}`)
        .join(', ');
}
function formatMoney(value) {
    if (value === null)
        return '--';
    return `$${value}`;
}
function formatBehaviorRow(entry) {
    const avgSpend = entry.avgAbilitySpend === null ? '--' : Math.round(entry.avgAbilitySpend).toString();
    const topBundle = entry.bundles[0]
        ? `${entry.bundles[0].bundle} (${(entry.bundles[0].rate * 100).toFixed(1)}%)`
        : '--';
    return [entry.map, entry.side, String(entry.exactCount), avgSpend, topBundle];
}
export function PistolUtilityExactSection({ data }) {
    const commandMode = useStore((s) => s.commandMode);
    const [expanded, setExpanded] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const [level, setLevel] = useState(0);
    const [mapIndex, setMapIndex] = useState(0);
    const [sideIndex, setSideIndex] = useState(0);
    const [matchIndex, setMatchIndex] = useState(0);
    const maps = data.drilldown.maps;
    const selectedMap = maps[mapIndex] ?? null;
    const sides = selectedMap ? sortSides(data.drilldown.sidesByMap[selectedMap] ?? []) : [];
    const selectedSide = sides[sideIndex] ?? null;
    const mapSideKey = selectedMap && selectedSide ? `${selectedMap}|${selectedSide}` : null;
    const rounds = mapSideKey ? data.drilldown.roundsByMapSide[mapSideKey] ?? [] : [];
    const selectedRound = rounds[matchIndex] ?? null;
    useEffect(() => {
        setMapIndex(0);
        setSideIndex(0);
        setMatchIndex(0);
        setLevel(0);
    }, [data]);
    useEffect(() => {
        setSideIndex(0);
        setMatchIndex(0);
        if (level > 0)
            setLevel(1);
    }, [selectedMap]);
    useEffect(() => {
        setMatchIndex(0);
        if (level > 1)
            setLevel(2);
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
        if (input.toLowerCase() === 'd') {
            setShowDebug((prev) => !prev);
            return;
        }
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
        String(row.analyzedCount),
        row.exactRate,
        row.topAbilities,
    ]), [data.summary]);
    const behaviorRows = useMemo(() => data.behavior.map((entry) => formatBehaviorRow(entry)), [data.behavior]);
    const selectedBehavior = useMemo(() => data.behavior.find((entry) => entry.map === selectedMap && entry.side === selectedSide) ?? null, [data.behavior, selectedMap, selectedSide]);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsxs(Text, { color: "cyan", children: [expanded ? 'v' : '>', " "] }), _jsxs(Text, { color: "gray", children: ["Press ", _jsx(Text, { color: "yellow", children: "U" }), " to ", expanded ? 'collapse' : 'expand'] })] }), expanded && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { bold: true, children: "Summary" }), summaryRows.length === 0 ? (_jsx(Text, { color: "gray", children: "No Round 1 economy snapshots available." })) : (_jsx(Table, { headers: ['Map', 'Side', 'Pistols analyzed', 'Exact rate', 'Top abilities'], rows: summaryRows })), _jsxs(Text, { color: "gray", children: ["Analyzed: ", data.meta.analyzedCount, " | Exact: ", data.meta.exactCount, " | Ambiguous: ", data.meta.ambiguousCount, " | No Solution: ", data.meta.noSolutionCount] })] }), _jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { bold: true, children: "Drill-down" }), maps.length === 0 ? (_jsx(Text, { color: "gray", children: "No map data available for Round 1." })) : (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "gray", children: "Map" }), maps.map((map, idx) => (_jsxs(Box, { children: [_jsx(Text, { color: level === 0 && idx === mapIndex ? 'cyan' : 'gray', children: level === 0 && idx === mapIndex ? '> ' : '  ' }), _jsx(Text, { bold: level === 0 && idx === mapIndex, children: map })] }, `map-${map}`))), selectedMap && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "gray", children: "Side" }), sides.length === 0 ? (_jsx(Text, { color: "gray", children: "No side data." })) : (sides.map((side, idx) => (_jsxs(Box, { children: [_jsx(Text, { color: level === 1 && idx === sideIndex ? 'cyan' : 'gray', children: level === 1 && idx === sideIndex ? '> ' : '  ' }), _jsx(Text, { bold: level === 1 && idx === sideIndex, children: side })] }, `side-${side}`))))] })), selectedSide && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "gray", children: "Match (Round 1)" }), rounds.length === 0 ? (_jsx(Text, { color: "gray", children: "No matches available." })) : (rounds.map((round, idx) => (_jsxs(Box, { children: [_jsx(Text, { color: level === 2 && idx === matchIndex ? 'cyan' : 'gray', children: level === 2 && idx === matchIndex ? '> ' : '  ' }), _jsxs(Text, { bold: level === 2 && idx === matchIndex, children: [round.matchDate, " vs ", round.opponentName] })] }, `match-${round.matchId}`))))] })), selectedRound && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Text, { color: "gray", children: ["Team: ", selectedRound.teamName, " | Map: ", selectedRound.mapName, " | Side: ", selectedRound.side] }), selectedRound.players.slice(0, 5).map((player) => (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Text, { children: [player.playerName, " (", player.agent, ") | ", formatMoney(player.moneyRemaining), " | ", player.weapon ?? '--', " | ", player.armor ?? '--', " | ", player.status] }), player.status === 'EXACT' && (_jsxs(Text, { color: "gray", children: ["  Abilities: ", formatAbilityList(player.abilities)] })), player.status === 'AMBIGUOUS' && (_jsxs(Text, { color: "gray", children: ['  ', "Ambiguous: ", player.solutionCount ?? 0, " solutions"] })), player.status === 'AMBIGUOUS' && showDebug && player.sampleSolutions && (_jsx(Box, { flexDirection: "column", marginLeft: 2, children: player.sampleSolutions.map((solution, idx) => (_jsxs(Text, { color: "gray", children: ["- ", solution] }, `${player.playerId}-sol-${idx}`))) })), player.status === 'NO_SOLUTION' && (_jsxs(Text, { color: "gray", children: ["  Reason: ", player.reason ?? 'unknown'] }))] }, player.playerId)))] }))] })), _jsxs(Text, { color: "gray", dimColor: true, children: ['Up/Down', " Navigate  ", 'Enter', " Select  ", 'Backspace', " Back  ", 'U', " Toggle  ", 'D', " Debug"] })] }), _jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { bold: true, children: "Behavior metrics (EXACT only)" }), behaviorRows.length === 0 ? (_jsx(Text, { color: "gray", children: "No exact records available for behavior metrics." })) : (_jsx(Table, { headers: ['Map', 'Side', 'Exact count', 'Avg ability spend', 'Top bundle'], rows: behaviorRows })), selectedBehavior && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "gray", children: "Utility investment distribution (selected map/side)" }), selectedBehavior.histogram.map((bucket) => (_jsxs(Text, { children: [bucket.bucket, ": ", bucket.count, " (", (bucket.rate * 100).toFixed(1), "%)"] }, `${bucket.bucket}`))), selectedBehavior.bundles.length > 0 && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "gray", children: "Common bundles" }), selectedBehavior.bundles.slice(0, 5).map((bundle) => (_jsxs(Text, { children: [bundle.bundle, ": ", bundle.count, " (", (bundle.rate * 100).toFixed(1), "%)"] }, bundle.bundle)))] }))] }))] })] }))] }));
}
