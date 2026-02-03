import fs from 'node:fs';
import path from 'node:path';
import { getTeamById, getTeamMatches } from '../../data/index.js';
import { getAppRoot } from '../../config.js';
const SIDE_CRED_LEVEL = 0.8;
const BETA_SAMPLES = 4000;
function mean(values) {
    if (values.length === 0)
        return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}
function median(values) {
    if (values.length === 0)
        return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}
function formatPct(value) {
    if (value === null)
        return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
}
function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
}
function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
function mulberry32(seed) {
    let t = seed >>> 0;
    return () => {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), t | 1);
        r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}
function randn(rng) {
    const u1 = Math.max(rng(), 1e-12);
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function gammaSample(shape, rng) {
    if (shape < 1) {
        const u = Math.max(rng(), 1e-12);
        return gammaSample(shape + 1, rng) * Math.pow(u, 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    while (true) {
        const x = randn(rng);
        const v = Math.pow(1 + c * x, 3);
        if (v <= 0)
            continue;
        const u = rng();
        if (u < 1 - 0.0331 * Math.pow(x, 4))
            return d * v;
        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v)))
            return d * v;
    }
}
function betaSample(alpha, beta, rng) {
    const x = gammaSample(alpha, rng);
    const y = gammaSample(beta, rng);
    return x / (x + y);
}
function posteriorSummary(wins, rounds, credLevel, seedLabel) {
    const alpha = wins + 1;
    const beta = rounds - wins + 1;
    const meanValue = (wins + 1) / (rounds + 2);
    if (rounds === 0) {
        return { wins, rounds, mean: meanValue, ciLow: null, ciHigh: null };
    }
    const rng = mulberry32(hashString(seedLabel));
    const samples = [];
    for (let i = 0; i < BETA_SAMPLES; i += 1) {
        samples.push(betaSample(alpha, beta, rng));
    }
    samples.sort((a, b) => a - b);
    const tail = (1 - credLevel) / 2;
    const loIdx = Math.max(0, Math.floor(tail * samples.length));
    const hiIdx = Math.min(samples.length - 1, Math.ceil((1 - tail) * samples.length) - 1);
    return {
        wins,
        rounds,
        mean: meanValue,
        ciLow: samples[loIdx] ?? null,
        ciHigh: samples[hiIdx] ?? null,
    };
}
function estimateDeltaProbabilities(attack, defense, deltaThreshold, seedLabel) {
    if (attack.rounds === 0 || defense.rounds === 0) {
        return { probGt: null, probLt: null };
    }
    const rng = mulberry32(hashString(seedLabel));
    let gt = 0;
    let lt = 0;
    for (let i = 0; i < BETA_SAMPLES; i += 1) {
        const a = betaSample(attack.wins + 1, attack.rounds - attack.wins + 1, rng);
        const d = betaSample(defense.wins + 1, defense.rounds - defense.wins + 1, rng);
        const delta = a - d;
        if (delta > deltaThreshold)
            gt += 1;
        if (delta < -deltaThreshold)
            lt += 1;
    }
    return { probGt: gt / BETA_SAMPLES, probLt: lt / BETA_SAMPLES };
}
function applyFilters(matches, filters) {
    if (!filters.map)
        return matches;
    const mapName = filters.map.toLowerCase();
    return matches.map(match => ({
        ...match,
        maps: match.maps.filter(m => m.mapName.toLowerCase() === mapName),
    })).filter(match => match.maps.length > 0);
}
function fitLogisticRidge(X, y, featureNames, lambda = 1, iterations = 4000, lr = 0.1) {
    if (X.length === 0)
        return null;
    const n = X.length;
    const m = X[0].length;
    if (y.length !== n)
        return null;
    const means = new Array(m).fill(0);
    const stds = new Array(m).fill(1);
    for (let j = 0; j < m; j += 1) {
        const col = X.map(row => row[j]);
        means[j] = mean(col) ?? 0;
        const variance = mean(col.map(v => (v - means[j]) ** 2)) ?? 0;
        stds[j] = Math.sqrt(variance) || 1;
    }
    const Xs = X.map(row => row.map((v, j) => (v - means[j]) / stds[j]));
    const weights = new Array(m + 1).fill(0);
    let prevLoss = Number.POSITIVE_INFINITY;
    let converged = false;
    for (let iter = 0; iter < iterations; iter += 1) {
        const grads = new Array(m + 1).fill(0);
        let loss = 0;
        for (let i = 0; i < n; i += 1) {
            let z = weights[0];
            for (let j = 0; j < m; j += 1) {
                z += weights[j + 1] * Xs[i][j];
            }
            const p = sigmoid(z);
            const err = p - y[i];
            grads[0] += err;
            for (let j = 0; j < m; j += 1) {
                grads[j + 1] += err * Xs[i][j];
            }
            loss += -y[i] * Math.log(Math.max(p, 1e-9)) - (1 - y[i]) * Math.log(Math.max(1 - p, 1e-9));
        }
        for (let j = 1; j < weights.length; j += 1) {
            grads[j] += lambda * weights[j];
            loss += 0.5 * lambda * weights[j] * weights[j];
        }
        const scale = 1 / n;
        for (let j = 0; j < weights.length; j += 1) {
            weights[j] -= lr * grads[j] * scale;
        }
        const avgLoss = loss / n;
        if (Math.abs(prevLoss - avgLoss) < 1e-6) {
            converged = true;
            break;
        }
        prevLoss = avgLoss;
    }
    return {
        coefficients: weights,
        means,
        stds,
        featureNames,
        lambda,
        iterations,
        converged,
    };
}
function predictLogistic(model, features) {
    let z = model.coefficients[0];
    for (let j = 0; j < features.length; j += 1) {
        const standardized = (features[j] - model.means[j]) / model.stds[j];
        z += model.coefficients[j + 1] * standardized;
    }
    return sigmoid(z);
}
function coefficientPerUnit(model, featureName) {
    const idx = model.featureNames.indexOf(featureName);
    if (idx === -1)
        return null;
    return model.coefficients[idx + 1] / model.stds[idx];
}
function computeSideIdentity(matches, teamId, filters) {
    const mapStats = new Map();
    for (const match of matches) {
        for (const map of match.maps) {
            for (const round of map.rounds) {
                const side = round.side?.[teamId];
                if (!side)
                    continue;
                if (filters.side && filters.side !== 'both' && side !== filters.side)
                    continue;
                const key = map.mapName || 'Unknown';
                const entry = mapStats.get(key) ?? {
                    attack: { wins: 0, rounds: 0 },
                    defense: { wins: 0, rounds: 0 },
                };
                const bucket = side === 'attacker' ? entry.attack : entry.defense;
                bucket.rounds += 1;
                if (round.winnerId === teamId)
                    bucket.wins += 1;
                mapStats.set(key, entry);
            }
        }
    }
    const stats = [];
    for (const [mapName, data] of mapStats.entries()) {
        const attackSummary = posteriorSummary(data.attack.wins, data.attack.rounds, SIDE_CRED_LEVEL, `${mapName}-attack-${data.attack.wins}-${data.attack.rounds}`);
        const defenseSummary = posteriorSummary(data.defense.wins, data.defense.rounds, SIDE_CRED_LEVEL, `${mapName}-defense-${data.defense.wins}-${data.defense.rounds}`);
        let identity = 'Balanced';
        let probDeltaGt = null;
        let probDeltaLt = null;
        if (attackSummary.rounds === 0 || defenseSummary.rounds === 0) {
            identity = 'N/A';
        }
        else if (!filters.side || filters.side === 'both') {
            const probs = estimateDeltaProbabilities(attackSummary, defenseSummary, 0.05, `${mapName}-delta`);
            probDeltaGt = probs.probGt;
            probDeltaLt = probs.probLt;
            if (probDeltaGt !== null && probDeltaGt > 0.8)
                identity = 'Attack-Sided';
            if (probDeltaLt !== null && probDeltaLt > 0.8)
                identity = 'Defense-Sided';
        }
        else {
            identity = 'N/A';
        }
        stats.push({
            mapName,
            attack: attackSummary,
            defense: defenseSummary,
            probDeltaGt,
            probDeltaLt,
            identity,
        });
    }
    return stats.sort((a, b) => a.mapName.localeCompare(b.mapName));
}
function computeClosingAbility(matches, teamId) {
    let opportunities = 0;
    let converted = 0;
    const featureRows = [];
    const targets = [];
    for (const match of matches) {
        for (const map of match.maps) {
            const teamStats = map.teamStats.find(s => s.teamId === teamId);
            const oppStats = map.teamStats.find(s => s.teamId !== teamId);
            if (!teamStats || !oppStats)
                continue;
            let teamScore = 0;
            let oppScore = 0;
            let reachedMatchPoint = false;
            let leadAt10 = null;
            let momentumAt10 = null;
            const recent = [];
            map.rounds.forEach((round, idx) => {
                const won = round.winnerId === teamId;
                if (round.winnerId) {
                    if (won)
                        teamScore += 1;
                    else
                        oppScore += 1;
                }
                recent.push(won);
                if (recent.length > 3)
                    recent.shift();
                if (!reachedMatchPoint && teamScore >= 12 && teamScore - oppScore === 1) {
                    reachedMatchPoint = true;
                    opportunities += 1;
                }
                if (idx === 9) {
                    leadAt10 = teamScore - oppScore;
                    const recentWins = recent.filter(Boolean).length;
                    momentumAt10 = recentWins / recent.length;
                }
            });
            if (reachedMatchPoint && teamStats.score > oppStats.score) {
                converted += 1;
            }
            const roundAtOrAbove10 = map.rounds.length >= 10 ? 1 : 0;
            const finalLead = teamScore - oppScore;
            const recentWins = recent.filter(Boolean).length;
            const momentumFinal = recent.length > 0 ? recentWins / recent.length : 0.5;
            const leadSize = leadAt10 ?? finalLead;
            const recentMomentum = momentumAt10 ?? momentumFinal;
            const mapPointStatus = reachedMatchPoint ? 1 : 0;
            featureRows.push([leadSize, roundAtOrAbove10, recentMomentum, mapPointStatus]);
            targets.push(teamStats.score > oppStats.score ? 1 : 0);
        }
    }
    const conversionRate = opportunities > 0 ? converted / opportunities : null;
    const failed = opportunities - converted;
    const model = featureRows.length >= 6
        ? fitLogisticRidge(featureRows, targets, ['leadSize', 'roundAtOrAbove10', 'recentMomentum', 'mapPointStatus'], 1.0, 4000, 0.1)
        : null;
    const closingCoefficient = model ? coefficientPerUnit(model, 'leadSize') : null;
    const scenarios = [
        { label: '11-11', leadSize: 0, roundAtOrAbove10: 1, recentMomentum: 0.5, mapPointStatus: 0 },
        { label: '12-10', leadSize: 2, roundAtOrAbove10: 1, recentMomentum: 0.5, mapPointStatus: 1 },
        { label: '12-11', leadSize: 1, roundAtOrAbove10: 1, recentMomentum: 0.5, mapPointStatus: 1 },
        { label: '10-12', leadSize: -2, roundAtOrAbove10: 1, recentMomentum: 0.5, mapPointStatus: 0 },
    ];
    const predictedStates = scenarios.map(s => ({
        label: s.label,
        winProb: model ? predictLogistic(model, [s.leadSize, s.roundAtOrAbove10, s.recentMomentum, s.mapPointStatus]) : null,
    }));
    return {
        opportunities,
        converted,
        conversionRate,
        failed,
        model,
        closingCoefficient,
        predictedStates,
        sampleCount: featureRows.length,
    };
}
function computePlayerDependence(matches, teamId) {
    const mapEntries = [];
    for (const match of matches) {
        for (const map of match.maps) {
            const teamStats = map.teamStats.find(s => s.teamId === teamId);
            const oppStats = map.teamStats.find(s => s.teamId !== teamId);
            if (!teamStats || !oppStats)
                continue;
            const playerTotals = new Map();
            for (const round of map.rounds) {
                for (const ps of round.playerStats) {
                    if (ps.teamId !== teamId)
                        continue;
                    const current = playerTotals.get(ps.playerId) ?? { name: ps.playerNickname || ps.playerId, kills: 0, deaths: 0 };
                    current.kills += ps.kills;
                    current.deaths += ps.deaths;
                    playerTotals.set(ps.playerId, current);
                }
            }
            const players = Array.from(playerTotals.entries()).map(([playerId, info]) => ({
                playerId,
                playerName: info.name,
                kdDiff: info.kills - info.deaths,
            }));
            if (players.length === 0)
                continue;
            mapEntries.push({
                mapName: map.mapName ?? 'Unknown',
                teamWon: teamStats.score > oppStats.score,
                playerStats: players,
            });
        }
    }
    const playerTotals = new Map();
    for (const entry of mapEntries) {
        for (const ps of entry.playerStats) {
            const current = playerTotals.get(ps.playerId) ?? { name: ps.playerName, kdDiffs: [] };
            current.kdDiffs.push(ps.kdDiff);
            playerTotals.set(ps.playerId, current);
        }
    }
    const rows = [];
    for (const [playerId, totals] of playerTotals.entries()) {
        const med = median(totals.kdDiffs) ?? 0;
        let goodWins = 0;
        let goodTotal = 0;
        let badWins = 0;
        let badTotal = 0;
        for (const entry of mapEntries) {
            const ps = entry.playerStats.find(p => p.playerId === playerId);
            if (!ps)
                continue;
            const isGood = ps.kdDiff >= med;
            if (isGood) {
                goodTotal += 1;
                if (entry.teamWon)
                    goodWins += 1;
            }
            else {
                badTotal += 1;
                if (entry.teamWon)
                    badWins += 1;
            }
        }
        const goodSummary = posteriorSummary(goodWins, goodTotal, SIDE_CRED_LEVEL, `${playerId}-good-${goodWins}-${goodTotal}`);
        const badSummary = posteriorSummary(badWins, badTotal, SIDE_CRED_LEVEL, `${playerId}-bad-${badWins}-${badTotal}`);
        const goodWinRate = goodTotal > 0 ? goodSummary.mean : null;
        const badWinRate = badTotal > 0 ? badSummary.mean : null;
        const lift = goodWinRate !== null && badWinRate !== null ? goodWinRate - badWinRate : null;
        const dependenceIndex = lift;
        rows.push({
            playerId,
            playerName: totals.name,
            goodWinRate,
            goodCiLow: goodSummary.ciLow,
            goodCiHigh: goodSummary.ciHigh,
            badWinRate,
            badCiLow: badSummary.ciLow,
            badCiHigh: badSummary.ciHigh,
            lift,
            dependenceIndex,
            goodSamples: goodTotal,
            badSamples: badTotal,
            impactCoef: null,
        });
    }
    // Ridge logistic regression on player impact scores (if enough data)
    const playerIds = Array.from(playerTotals.keys());
    const mapNames = Array.from(new Set(mapEntries.map(m => m.mapName)));
    const includeMapControls = mapNames.length > 1;
    const featureNames = [...playerIds.map(id => `impact:${id}`)];
    if (includeMapControls) {
        featureNames.push(...mapNames.slice(1).map(name => `map:${name}`));
    }
    const featureRows = [];
    const targets = [];
    for (const entry of mapEntries) {
        const row = [];
        for (const playerId of playerIds) {
            const ps = entry.playerStats.find(p => p.playerId === playerId);
            row.push(ps ? ps.kdDiff : 0);
        }
        if (includeMapControls) {
            for (const mapName of mapNames.slice(1)) {
                row.push(entry.mapName === mapName ? 1 : 0);
            }
        }
        featureRows.push(row);
        targets.push(entry.teamWon ? 1 : 0);
    }
    if (featureRows.length >= playerIds.length + 2) {
        const model = fitLogisticRidge(featureRows, targets, featureNames, 1.0, 4000, 0.1);
        if (model) {
            for (const row of rows) {
                const name = `impact:${row.playerId}`;
                row.impactCoef = coefficientPerUnit(model, name);
            }
        }
    }
    return rows.sort((a, b) => (b.dependenceIndex ?? -Infinity) - (a.dependenceIndex ?? -Infinity));
}
let cachedSummaryTemplates = null;
function loadSummaryTemplates() {
    if (cachedSummaryTemplates)
        return cachedSummaryTemplates;
    const templatePath = path.join(getAppRoot(), 'data', 'raw', 'Summary_Template.md');
    const templates = { side: [], closing: [], player: [], focus: [] };
    let current = null;
    try {
        const raw = fs.readFileSync(templatePath, 'utf8');
        for (const line of raw.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (trimmed.startsWith('## ')) {
                const lower = trimmed.toLowerCase();
                if (lower.includes('side-half'))
                    current = 'side';
                else if (lower.includes('closing ability'))
                    current = 'closing';
                else if (lower.includes('player outcome'))
                    current = 'player';
                else if (lower.includes('summary conclusion'))
                    current = 'focus';
                else
                    current = null;
                continue;
            }
            if (current && trimmed.startsWith('- ')) {
                templates[current].push(trimmed.slice(2).trim());
            }
        }
    }
    catch {
        // Leave templates empty to allow graceful fallback.
    }
    cachedSummaryTemplates = templates;
    return templates;
}
function fillTemplate(template, values) {
    return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}
function pickVariant(variants, key) {
    if (variants.length === 0)
        return '';
    const idx = Math.abs(hashString(key)) % variants.length;
    return variants[idx];
}
function generateWinConSummary({ sideStats, closingStats, dependenceRows, }) {
    const templates = loadSummaryTemplates();
    const hasSideData = sideStats.some(stat => stat.attack.rounds + stat.defense.rounds > 0);
    const hasClosingData = closingStats.sampleCount > 0 || closingStats.conversionRate !== null;
    const hasDependenceData = dependenceRows.length > 0;
    if (!hasSideData || !hasClosingData || !hasDependenceData) {
        return 'Not enough high-confidence data to generate a Win Condition Summary.';
    }
    const sideCandidate = sideStats
        .filter(stat => stat.identity === 'Attack-Sided' || stat.identity === 'Defense-Sided')
        .map(stat => {
        const delta = stat.attack.mean - stat.defense.mean;
        const confidence = delta >= 0 ? stat.probDeltaGt : stat.probDeltaLt;
        return { stat, delta, confidence };
    })
        .filter(entry => entry.confidence !== null)
        .sort((a, b) => {
        const scoreA = Math.abs(a.delta) * (a.confidence ?? 0);
        const scoreB = Math.abs(b.delta) * (b.confidence ?? 0);
        return scoreB - scoreA;
    })[0] ?? null;
    const sideVariants = templates.side;
    const attackVariants = sideVariants.filter(v => v.toLowerCase().includes('attack'));
    const defenseVariants = sideVariants.filter(v => v.toLowerCase().includes('defense'));
    const balancedVariants = sideVariants.filter(v => v.toLowerCase().includes('balanced') || v.toLowerCase().includes('mixed'));
    const sideValues = {
        map: sideCandidate?.stat.mapName ?? 'Unknown',
        delta: `*${Math.round(Math.abs(sideCandidate?.delta ?? 0) * 100)}*`,
        confidence: `*${Math.round((sideCandidate?.confidence ?? 0) * 100)}*`,
    };
    const sidePool = sideCandidate
        ? (sideCandidate.delta >= 0 ? (attackVariants.length > 0 ? attackVariants : sideVariants) : (defenseVariants.length > 0 ? defenseVariants : sideVariants))
        : (balancedVariants.length > 0 ? balancedVariants : sideVariants);
    const sideTemplate = pickVariant(sidePool, sideValues.map);
    const sideText = sideTemplate ? fillTemplate(sideTemplate, sideValues) : 'Balanced side performance â€“ no significant identity detected.';
    const conversionPct = closingStats.conversionRate !== null
        ? Math.round(closingStats.conversionRate * 100)
        : null;
    const closingVariants = templates.closing;
    const closingNegative = closingVariants.filter(v => v.toLowerCase().includes('negative') || v.toLowerCase().includes('choke'));
    const closingWeak = closingVariants.filter(v => v.toLowerCase().includes('weak') || v.toLowerCase().includes('poorly') || v.toLowerCase().includes('below average'));
    const closingStrong = closingVariants.filter(v => v.toLowerCase().includes('above-average') || v.toLowerCase().includes('strong'));
    const closingPool = closingStats.closingCoefficient !== null && closingStats.closingCoefficient < 0
        ? (closingNegative.length > 0 ? closingNegative : closingVariants)
        : conversionPct !== null && conversionPct < 60
            ? (closingWeak.length > 0 ? closingWeak : closingVariants)
            : conversionPct !== null && conversionPct >= 70
                ? (closingStrong.length > 0 ? closingStrong : closingVariants)
                : (closingVariants.length > 0 ? closingVariants : ['Closing data inconclusive.']);
    const closingTemplate = pickVariant(closingPool, String(conversionPct ?? 0));
    const closingText = fillTemplate(closingTemplate, {
        conversion: conversionPct !== null ? `*${conversionPct}*` : '*N/A*',
    });
    const closingLabel = (conversionPct !== null && conversionPct >= 70) ? 'Closing Strength' : 'Closing Weakness';
    const playerVariants = templates.player;
    const playerNoDep = playerVariants.filter(v => v.toLowerCase().includes('no significant') || v.toLowerCase().includes('loosely'));
    const playerVolatile = playerVariants.filter(v => v.toLowerCase().includes('volatile') || v.toLowerCase().includes('overperforms'));
    const playerHigh = playerVariants.filter(v => v.toLowerCase().includes('hinge') || v.toLowerCase().includes('high-leverage'));
    const playerConsistent = playerVariants.filter(v => v.toLowerCase().includes('consistency'));
    const playerCandidate = dependenceRows.find(row => row.lift !== null) ?? null;
    const playerName = playerCandidate?.playerName ?? 'Unknown';
    const totalSamples = playerCandidate ? playerCandidate.goodSamples + playerCandidate.badSamples : 0;
    const overperformRate = playerCandidate && totalSamples > 0 ? playerCandidate.goodSamples / totalSamples : null;
    const liftPts = playerCandidate && playerCandidate.lift !== null
        ? Math.round(playerCandidate.lift * 100)
        : null;
    const playerPool = playerCandidate && liftPts !== null && overperformRate !== null
        ? (liftPts >= 25 && overperformRate < 0.25
            ? (playerVolatile.length > 0 ? playerVolatile : playerVariants)
            : liftPts >= 25
                ? (playerHigh.length > 0 ? playerHigh : playerVariants)
                : liftPts >= 10
                    ? (playerConsistent.length > 0 ? playerConsistent : playerVariants)
                    : (playerNoDep.length > 0 ? playerNoDep : playerVariants))
        : (playerNoDep.length > 0 ? playerNoDep : playerVariants);
    const playerTemplate = pickVariant(playerPool, playerName);
    const playerText = fillTemplate(playerTemplate, {
        player: playerName,
        lift: liftPts !== null ? `*${liftPts}*` : '*0*',
        frequency: overperformRate !== null ? `*${Math.round(overperformRate * 100)}*` : '*0*',
    });
    const focusVariants = templates.focus;
    const focusByMap = focusVariants.filter(v => v.toLowerCase().includes('{map}'));
    const focusByPlayer = focusVariants.filter(v => v.toLowerCase().includes('{player}'));
    const focusClosing = focusVariants.filter(v => v.toLowerCase().includes('late-round') || v.toLowerCase().includes('pressure'));
    const focusFallback = focusVariants.filter(v => !v.toLowerCase().includes('{map}') && !v.toLowerCase().includes('{player}'));
    const focusPool = sideCandidate
        ? (focusByMap.length > 0 ? focusByMap : focusVariants)
        : playerCandidate
            ? (focusByPlayer.length > 0 ? focusByPlayer : focusVariants)
            : (conversionPct !== null && conversionPct < 60 && focusClosing.length > 0 ? focusClosing : focusFallback);
    const focusTemplate = pickVariant(focusPool, sideValues.map + playerName);
    const focusLine = fillTemplate(focusTemplate, {
        map: sideValues.map,
        player: playerName,
    });
    const bullets = [
        `- **Performs Best On**: ${sideText}`,
        `- **${closingLabel}**: ${closingText}`,
        `- **Player Dependence**: ${playerText}`,
    ];
    return `${bullets.join('\n')}\n${focusLine}`.trim();
}
export async function generateWinconReport(teamId, filters) {
    const team = await getTeamById(teamId);
    if (!team) {
        throw new Error(`team not found: ${teamId}`);
    }
    const matches = await getTeamMatches(teamId);
    const windowedMatches = applyFilters(matches.slice(0, filters.window || 5), filters);
    const sideStats = computeSideIdentity(windowedMatches, teamId, filters);
    const closingStats = computeClosingAbility(windowedMatches, teamId);
    const dependenceRows = computePlayerDependence(windowedMatches, teamId);
    const sideIdentityRows = sideStats.map(stat => ([
        stat.mapName,
        `${formatPct(stat.attack.mean)} (${stat.attack.wins}/${stat.attack.rounds})`,
        stat.attack.ciLow !== null && stat.attack.ciHigh !== null
            ? `${formatPct(stat.attack.ciLow)}–${formatPct(stat.attack.ciHigh)}`
            : 'N/A',
        `${formatPct(stat.defense.mean)} (${stat.defense.wins}/${stat.defense.rounds})`,
        stat.defense.ciLow !== null && stat.defense.ciHigh !== null
            ? `${formatPct(stat.defense.ciLow)}–${formatPct(stat.defense.ciHigh)}`
            : 'N/A',
        stat.probDeltaGt !== null ? formatPct(stat.probDeltaGt) : 'N/A',
        stat.probDeltaLt !== null ? formatPct(stat.probDeltaLt) : 'N/A',
        stat.identity,
    ]));
    const identityInsights = sideStats.length > 0
        ? sideStats.map(stat => {
            const probText = stat.probDeltaGt !== null && stat.probDeltaLt !== null
                ? `P(Δ>0.05)=${formatPct(stat.probDeltaGt)}, P(Δ<-0.05)=${formatPct(stat.probDeltaLt)}`
                : 'Insufficient side data';
            return `${stat.mapName}: ${stat.identity} (${probText})`;
        })
        : ['No side data available for current window.'];
    const closingText = closingStats.model
        ? `Model trained on ${closingStats.sampleCount} maps. Lead coefficient (log-odds per round) = ${closingStats.closingCoefficient?.toFixed(3) ?? 'N/A'}. Match-point conversion: ${closingStats.opportunities > 0 ? formatPct(closingStats.conversionRate) : 'N/A'} (${closingStats.converted}/${closingStats.opportunities}).`
        : `Insufficient data for logistic model. Match-point conversion: ${closingStats.opportunities > 0 ? formatPct(closingStats.conversionRate) : 'N/A'} (${closingStats.converted}/${closingStats.opportunities}).`;
    const closingRows = closingStats.predictedStates.map(p => ([
        p.label,
        p.winProb !== null ? formatPct(p.winProb) : 'N/A',
    ]));
    const dependenceTable = dependenceRows.map((row) => ([
        row.playerName,
        row.goodWinRate === null
            ? 'N/A'
            : `${formatPct(row.goodWinRate)} (${row.goodSamples})`,
        row.goodCiLow !== null && row.goodCiHigh !== null
            ? `${formatPct(row.goodCiLow)}–${formatPct(row.goodCiHigh)}`
            : 'N/A',
        row.badWinRate === null
            ? 'N/A'
            : `${formatPct(row.badWinRate)} (${row.badSamples})`,
        row.badCiLow !== null && row.badCiHigh !== null
            ? `${formatPct(row.badCiLow)}–${formatPct(row.badCiHigh)}`
            : 'N/A',
        row.dependenceIndex === null ? 'N/A' : formatPct(row.dependenceIndex),
        row.impactCoef === null ? 'N/A' : row.impactCoef.toFixed(3),
    ]));
    const topDependence = dependenceRows[0];
    const dependenceText = topDependence && topDependence.dependenceIndex !== null
        ? `Most dependent on ${topDependence.playerName} (lift ${formatPct(topDependence.dependenceIndex)} when above median impact).`
        : 'Not enough player data to estimate dependence.';
    const summaryText = generateWinConSummary({ sideStats, closingStats, dependenceRows });
    const sections = [
        {
            heading: 'Side-Half Identity',
            content: {
                type: 'table',
                headers: ['Map', 'Attack Mean', 'Attack CI', 'Defense Mean', 'Defense CI', 'P(Δ>0.05)', 'P(Δ<-0.05)', 'Identity'],
                rows: sideIdentityRows.length > 0 ? sideIdentityRows : [['No data', '-', '-', '-', '-', '-', '-', '-']],
            },
        },
        {
            heading: 'Side-Half Identity Insight',
            content: {
                type: 'bullets',
                items: identityInsights,
            },
        },
        {
            heading: 'Closing Ability Under Pressure',
            content: {
                type: 'text',
                value: closingText,
            },
        },
        {
            heading: 'Closing Ability Model Scenarios',
            content: {
                type: 'table',
                headers: ['Score State', 'Predicted Win%'],
                rows: closingRows.length > 0 ? closingRows : [['No model', 'N/A']],
            },
        },
        {
            heading: 'Player Outcome Dependence',
            content: {
                type: 'table',
                headers: ['Player', 'Win% (good)', 'Good CI', 'Win% (bad)', 'Bad CI', 'Dependence', 'Impact Coef'],
                rows: dependenceTable.length > 0 ? dependenceTable : [['No data', '-', '-', '-', '-', '-', '-']],
            },
        },
        {
            heading: 'Player Outcome Dependence Insight',
            content: {
                type: 'text',
                value: dependenceText,
            },
        },
        {
            heading: 'Win Condition Summary (W)',
            content: {
                type: 'text',
                value: summaryText,
            },
        },
    ];
    return {
        type: 'wincon',
        title: `Win Conditions - ${team.name}`,
        entityType: 'team',
        entityId: team.id,
        entityName: team.name,
        generatedAt: new Date().toISOString(),
        filters,
        sections,
    };
}
