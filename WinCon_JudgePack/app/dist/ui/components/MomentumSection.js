import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Table } from './Table.js';
import { useStore } from '../context/store.js';
function formatPercent(rate) {
    return `${(rate * 100).toFixed(0)}%`;
}
function formatPercentDetailed(rate) {
    return `${(rate * 100).toFixed(1)}%`;
}
function renderBar(value, maxValue = 1, width = 10) {
    const ratio = maxValue > 0 ? Math.min(value / maxValue, 1) : 0;
    const filled = Math.round(ratio * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
}
function getSignificanceColor(significance) {
    switch (significance) {
        case 'high': return 'yellow';
        case 'medium': return 'white';
        case 'low': return 'gray';
    }
}
export function MomentumSection({ data }) {
    const commandMode = useStore((s) => s.commandMode);
    const expanded = useStore((s) => s.momentumExpanded);
    const toggleMomentum = useStore((s) => s.toggleMomentum);
    const [activeTab, setActiveTab] = useState('overview');
    const tabs = ['overview', 'pistol', 'streaks', 'heat'];
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
    const sideRows = useMemo(() => data.sidePerformance.map((sp) => [
        sp.map,
        `${sp.attackRoundsWon}/${sp.attackRoundsPlayed}`,
        formatPercent(sp.attackWinRate),
        `${sp.defenseRoundsWon}/${sp.defenseRoundsPlayed}`,
        formatPercent(sp.defenseWinRate),
        sp.strongerSide,
    ]), [data.sidePerformance]);
    const pistolRows = useMemo(() => data.pistolPerformance.map((pp) => [
        pp.map,
        `${pp.pistolRoundsWon}/${pp.pistolRoundsPlayed}`,
        formatPercent(pp.pistolWinRate),
        formatPercent(pp.attackPistolWinRate),
        formatPercent(pp.defensePistolWinRate),
        formatPercent(pp.mapWinRateGivenPistolWin),
        formatPercent(pp.mapWinRateGivenPistolLoss),
    ]), [data.pistolPerformance]);
    const postPistolRows = useMemo(() => data.postPistolPerformance.map((pp) => [
        pp.map,
        formatPercent(pp.postPistolWinRate),
        formatPercent(pp.postPistolWinRateAfterPistolWin),
        formatPercent(pp.forceBreakRate),
        `${pp.pistolWinThenPostPistolWin}/${pp.pistolWinThenPostPistolWin + pp.pistolWinThenPostPistolLoss}`,
        `${pp.pistolLossThenPostPistolWin}/${pp.pistolLossThenPostPistolWin + pp.pistolLossThenPostPistolLoss}`,
    ]), [data.postPistolPerformance]);
    const streakRows = useMemo(() => data.streakStats.map((ss) => [
        ss.map,
        String(ss.maxStreak),
        ss.avgStreakLength.toFixed(1),
        String(ss.twoRoundStreaks),
        String(ss.threeRoundStreaks),
        String(ss.fourPlusStreaks),
    ]), [data.streakStats]);
    const continuationRows = useMemo(() => data.streakContinuation.map((sc) => [
        sc.map,
        `${formatPercent(sc.winAfter1Win)} (${sc.winAfter1WinSamples})`,
        `${formatPercent(sc.winAfter2Wins)} (${sc.winAfter2WinsSamples})`,
        `${formatPercent(sc.winAfter3Wins)} (${sc.winAfter3WinsSamples})`,
    ]), [data.streakContinuation]);
    const conditionalRows = useMemo(() => data.conditionalSignals.map((cs) => [
        cs.map,
        `${formatPercent(cs.mapWinRateGivenPistolWin)} (${cs.samples.pistolWins})`,
        `${formatPercent(cs.mapWinRateGivenPostPistolWin)} (${cs.samples.postPistolWins})`,
        `${formatPercent(cs.mapWinRateGivenEarlyStreak)} (${cs.samples.earlyStreaks})`,
    ]), [data.conditionalSignals]);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsxs(Text, { color: "cyan", children: [expanded ? 'v' : '>', " "] }), _jsxs(Text, { color: "gray", children: ["Press ", _jsx(Text, { color: "yellow", children: "M" }), " to ", expanded ? 'collapse' : 'expand', " momentum analysis"] })] }), expanded && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Box, { marginBottom: 1, flexDirection: "column", children: [_jsxs(Text, { bold: true, children: ["Aggregated (", data.aggregated.totalMaps, " maps)"] }), _jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Round WR: " }), _jsx(Text, { bold: true, children: formatPercent(data.aggregated.overallWinRate) }), _jsx(Text, { color: "gray", children: " | Pistol WR: " }), _jsx(Text, { bold: true, children: formatPercent(data.aggregated.overallPistolWinRate) }), _jsx(Text, { color: "gray", children: " | Attack WR: " }), _jsx(Text, { bold: true, color: data.aggregated.overallAttackWinRate >= 0.5 ? 'green' : 'red', children: formatPercent(data.aggregated.overallAttackWinRate) }), _jsx(Text, { color: "gray", children: " | Defense WR: " }), _jsx(Text, { bold: true, color: data.aggregated.overallDefenseWinRate >= 0.5 ? 'green' : 'red', children: formatPercent(data.aggregated.overallDefenseWinRate) })] })] }), _jsx(Box, { marginBottom: 1, children: tabs.map((tab, idx) => (_jsx(Box, { marginRight: 2, children: _jsxs(Text, { color: activeTab === tab ? 'cyan' : 'gray', bold: activeTab === tab, children: ["[", idx + 1, "] ", tab.charAt(0).toUpperCase() + tab.slice(1)] }) }, tab))) }), _jsx(Text, { color: "gray", dimColor: true, children: "Left/Right arrows to switch tabs" }), _jsxs(Box, { flexDirection: "column", marginTop: 1, children: [activeTab === 'overview' && (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, color: "yellow", children: "Side Performance" }), sideRows.length === 0 ? (_jsx(Text, { color: "gray", children: "No data available." })) : (_jsx(Table, { headers: ['Map', 'Atk W/P', 'Atk WR', 'Def W/P', 'Def WR', 'Stronger'], rows: sideRows })), _jsx(Box, { marginTop: 1, children: _jsx(Text, { bold: true, color: "yellow", children: "Map Win Signals" }) }), conditionalRows.length === 0 ? (_jsx(Text, { color: "gray", children: "No data available." })) : (_jsx(Table, { headers: ['Map', 'WR|Pistol Win', 'WR|Post-Pistol Win', 'WR|Early Streak'], rows: conditionalRows }))] })), activeTab === 'pistol' && (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, color: "yellow", children: "Pistol Round Performance" }), pistolRows.length === 0 ? (_jsx(Text, { color: "gray", children: "No data available." })) : (_jsx(Table, { headers: ['Map', 'W/P', 'WR', 'Atk WR', 'Def WR', 'Map WR|Win', 'Map WR|Loss'], rows: pistolRows })), _jsx(Box, { marginTop: 1, children: _jsx(Text, { bold: true, color: "yellow", children: "Post-Pistol (R2/R14) Performance" }) }), postPistolRows.length === 0 ? (_jsx(Text, { color: "gray", children: "No data available." })) : (_jsx(Table, { headers: ['Map', 'Post WR', 'After P Win', 'Force Break', 'P Win->Post', 'P Loss->Post'], rows: postPistolRows }))] })), activeTab === 'streaks' && (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, color: "yellow", children: "Win Streak Analysis" }), streakRows.length === 0 ? (_jsx(Text, { color: "gray", children: "No data available." })) : (_jsx(Table, { headers: ['Map', 'Max', 'Avg', '2-Round', '3-Round', '4+ Round'], rows: streakRows })), _jsx(Box, { marginTop: 1, children: _jsx(Text, { bold: true, color: "yellow", children: "Streak Continuation P(win next | streak)" }) }), continuationRows.length === 0 ? (_jsx(Text, { color: "gray", children: "No data available." })) : (_jsx(Table, { headers: ['Map', 'After 1 Win', 'After 2 Wins', 'After 3 Wins'], rows: continuationRows }))] })), activeTab === 'heat' && (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, color: "yellow", children: "Heat Zones (Round Ranges)" }), data.heatZones.length === 0 ? (_jsx(Text, { color: "gray", children: "No data available." })) : (_jsxs(Box, { flexDirection: "column", children: [data.heatZones.map((hz) => (_jsxs(Box, { marginBottom: 0, children: [_jsx(Text, { color: getSignificanceColor(hz.significance), children: hz.roundRange.padEnd(18) }), _jsx(Text, { color: "cyan", children: renderBar(hz.winRate, 1, 12) }), _jsxs(Text, { children: [" ", formatPercentDetailed(hz.winRate).padStart(6), " WR "] }), _jsxs(Text, { color: "gray", children: ["| Streak Start: ", formatPercent(hz.streakStartRate).padStart(4), " "] }), _jsxs(Text, { color: "gray", children: ["| Streak End: ", formatPercent(hz.streakEndRate).padStart(4)] })] }, hz.roundRange))), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "gray", children: ["Significance: ", _jsx(Text, { color: "yellow", children: "High" }), " (yellow) |", ' ', _jsx(Text, { color: "white", children: "Medium" }), " (white) |", ' ', _jsx(Text, { color: "gray", children: "Low" }), " (gray)"] }) })] }))] }))] })] }))] }));
}
