import { getArmorInfo, getPistolLegalArmor, getPistolLegalWeapons, getPurchasableAbilities, getWeaponInfo, PISTOL_ROUND_CREDITS, } from './shopCosts.js';
const abilityComboCache = new Map();
const fallbackCache = new Map();
const HISTOGRAM_BUCKETS = [
    { label: '0', min: 0, max: 0 },
    { label: '1-100', min: 1, max: 100 },
    { label: '101-200', min: 101, max: 200 },
    { label: '201-300', min: 201, max: 300 },
    { label: '301-400', min: 301, max: 400 },
    { label: '401-500', min: 401, max: 500 },
    { label: '501+', min: 501, max: Number.POSITIVE_INFINITY },
];
function normalizeKey(value) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function parseTimestampField(value) {
    if (value === null || value === undefined)
        return value;
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number')
        return value;
    return null;
}
function parseNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
function formatMapName(name) {
    if (!name)
        return 'Unknown';
    return name.charAt(0).toUpperCase() + name.slice(1);
}
function sideLabel(side) {
    if (side === 'attacker')
        return 'Attack';
    if (side === 'defender')
        return 'Defense';
    return 'Unknown';
}
function getSnapshotTimestamp(snapshot) {
    if (snapshot.timestamp === undefined || snapshot.timestamp === null)
        return null;
    if (typeof snapshot.timestamp === 'number')
        return snapshot.timestamp;
    const parsed = Date.parse(snapshot.timestamp);
    return Number.isNaN(parsed) ? null : parsed;
}
function pickEarliestSnapshot(snapshots) {
    if (snapshots.length === 0)
        return null;
    const withTimestamp = snapshots
        .map((snap) => ({ snap, ts: getSnapshotTimestamp(snap) }))
        .filter((entry) => entry.ts !== null);
    if (withTimestamp.length === 0)
        return snapshots[0];
    withTimestamp.sort((a, b) => a.ts - b.ts);
    return withTimestamp[0]?.snap ?? snapshots[0];
}
function extractSnapshots(round) {
    if (!round || typeof round !== 'object')
        return [];
    const typedRound = round;
    if (Array.isArray(typedRound.playerEconomySnapshots)) {
        return typedRound.playerEconomySnapshots.map((snapshot) => ({
            timestamp: parseTimestampField(snapshot.timestamp),
            players: Array.isArray(snapshot.players) ? snapshot.players : [],
        }));
    }
    const candidateKeys = [
        'economySnapshots',
        'economySnapshot',
        'playerEconomySnapshots',
        'playerEconomy',
    ];
    for (const key of candidateKeys) {
        const value = typedRound[key];
        if (!value)
            continue;
        if (Array.isArray(value)) {
            if (value.length === 0)
                return [];
            const first = value[0];
            if (first && typeof first === 'object' && Array.isArray(first.players)) {
                return value.map((entry) => ({
                    timestamp: parseTimestampField(entry.timestamp ?? entry.time),
                    players: Array.isArray(entry.players) ? entry.players : [],
                }));
            }
            return [{ timestamp: null, players: value }];
        }
        if (typeof value === 'object') {
            const record = value;
            if (Array.isArray(record.players)) {
                return [{
                        timestamp: parseTimestampField(record.timestamp ?? record.time),
                        players: record.players,
                    }];
            }
        }
    }
    return [];
}
function extractPlayerId(entry) {
    if (!entry || typeof entry !== 'object')
        return null;
    const record = entry;
    if (record.playerId)
        return String(record.playerId);
    if (record.id)
        return String(record.id);
    if (record.player && typeof record.player === 'object') {
        const player = record.player;
        if (player.id)
            return String(player.id);
    }
    return null;
}
function extractPlayerName(entry) {
    if (!entry || typeof entry !== 'object')
        return null;
    const record = entry;
    if (record.playerName)
        return String(record.playerName);
    if (record.name)
        return String(record.name);
    if (record.player && typeof record.player === 'object') {
        const player = record.player;
        if (player.name)
            return String(player.name);
    }
    return null;
}
function extractMoneyRemaining(entry) {
    if (!entry || typeof entry !== 'object')
        return null;
    const record = entry;
    const direct = parseNumber(record.moneyRemaining ??
        record.money ??
        (record.economy && typeof record.economy === 'object'
            ? record.economy.money
            : undefined) ??
        record.credits ??
        record.remaining ??
        record.balance ??
        record.bank);
    if (direct !== null)
        return direct;
    const netWorth = parseNumber(record.netWorth ??
        (record.economy && typeof record.economy === 'object'
            ? record.economy.netWorth
            : undefined));
    const loadoutValue = parseNumber(record.loadoutValue ??
        (record.economy && typeof record.economy === 'object'
            ? record.economy.loadoutValue
            : undefined));
    if (netWorth !== null && loadoutValue !== null) {
        const computed = netWorth - loadoutValue;
        return Number.isFinite(computed) ? computed : null;
    }
    return null;
}
function normalizeItemRef(item) {
    if (item === null || item === undefined)
        return item;
    if (typeof item === 'string')
        return item;
    if (typeof item === 'object') {
        const record = item;
        return {
            uuid: record.uuid ? String(record.uuid) : (record.id ? String(record.id) : undefined),
            name: record.name ? String(record.name) : (record.displayName ? String(record.displayName) : undefined),
        };
    }
    return undefined;
}
function extractWeaponRef(entry) {
    if (!entry || typeof entry !== 'object')
        return undefined;
    const record = entry;
    if (record.weaponId || record.weaponName) {
        return {
            uuid: record.weaponId ? String(record.weaponId) : undefined,
            name: record.weaponName ? String(record.weaponName) : undefined,
        };
    }
    if (record.weapon)
        return normalizeItemRef(record.weapon);
    if (record.primaryWeapon)
        return normalizeItemRef(record.primaryWeapon);
    if (record.primary)
        return normalizeItemRef(record.primary);
    if (record.weaponName || record.weaponId) {
        return {
            name: record.weaponName ? String(record.weaponName) : undefined,
            uuid: record.weaponId ? String(record.weaponId) : undefined,
        };
    }
    return undefined;
}
function extractArmorRef(entry) {
    if (!entry || typeof entry !== 'object')
        return undefined;
    const record = entry;
    if (record.armorId || record.armorName) {
        return {
            uuid: record.armorId ? String(record.armorId) : undefined,
            name: record.armorName ? String(record.armorName) : undefined,
        };
    }
    if (record.armor !== undefined)
        return normalizeItemRef(record.armor);
    if (record.shield !== undefined)
        return normalizeItemRef(record.shield);
    if (record.shields !== undefined)
        return normalizeItemRef(record.shields);
    if (record.armorName || record.armorId) {
        return {
            name: record.armorName ? String(record.armorName) : undefined,
            uuid: record.armorId ? String(record.armorId) : undefined,
        };
    }
    return undefined;
}
function resolveWeaponCost(ref) {
    if (ref === undefined || ref === null) {
        return { known: false, cost: 0, name: null };
    }
    const name = typeof ref === 'string' ? ref : (ref.name ?? null);
    const uuid = typeof ref === 'string' ? null : (ref.uuid ?? null);
    if (uuid) {
        const info = getWeaponInfo(uuid);
        if (info)
            return { known: true, cost: info.cost, name: info.name };
    }
    if (name) {
        const info = getWeaponInfo(name);
        if (info)
            return { known: true, cost: info.cost, name: info.name };
        if (normalizeKey(name).includes('classic')) {
            return { known: true, cost: 0, name: 'Classic' };
        }
    }
    return { known: false, cost: 0, name: name ?? null };
}
function resolveArmorCost(ref) {
    if (ref === undefined) {
        return { known: false, cost: 0, name: null };
    }
    if (ref === null) {
        return { known: true, cost: 0, name: 'No Armor' };
    }
    const name = typeof ref === 'string' ? ref : (ref.name ?? null);
    const uuid = typeof ref === 'string' ? null : (ref.uuid ?? null);
    if (name && normalizeKey(name).includes('noarmor')) {
        return { known: true, cost: 0, name: 'No Armor' };
    }
    if (uuid) {
        const info = getArmorInfo(uuid);
        if (info)
            return { known: true, cost: info.cost, name: info.name };
    }
    if (name) {
        const info = getArmorInfo(name);
        if (info)
            return { known: true, cost: info.cost, name: info.name };
    }
    return { known: false, cost: 0, name: name ?? null };
}
function buildAbilityComboString(abilities) {
    if (!abilities || abilities.length === 0)
        return 'No Abilities';
    const sorted = [...abilities].sort((a, b) => a.name.localeCompare(b.name));
    return sorted.map((ability) => `${ability.name} x${ability.charges}`).join(', ');
}
function buildBundleKey(abilities) {
    return buildAbilityComboString(abilities);
}
function getAbilityCombos(agentName, abilityBudget) {
    const key = `${normalizeKey(agentName)}|${abilityBudget}`;
    const cached = abilityComboCache.get(key);
    if (cached)
        return cached;
    const abilities = getPurchasableAbilities(agentName)
        .filter((ability) => ability.maxCharges > 0 && ability.unitCost > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
    const results = [];
    const current = [];
    const dfs = (index, runningCost) => {
        if (runningCost > abilityBudget)
            return;
        if (index >= abilities.length) {
            if (runningCost === abilityBudget) {
                results.push({
                    abilities: [...current],
                    totalCost: runningCost,
                });
            }
            return;
        }
        const ability = abilities[index];
        for (let charges = 0; charges <= ability.maxCharges; charges += 1) {
            const addedCost = charges * ability.unitCost;
            if (runningCost + addedCost > abilityBudget)
                break;
            if (charges > 0) {
                current.push({
                    name: ability.name,
                    charges,
                    unitCost: ability.unitCost,
                    totalCost: addedCost,
                });
            }
            dfs(index + 1, runningCost + addedCost);
            if (charges > 0) {
                current.pop();
            }
        }
    };
    dfs(0, 0);
    abilityComboCache.set(key, results);
    return results;
}
export function inferAbilityPurchasesExact(input) {
    const moneyRemaining = input.moneyRemaining;
    if (moneyRemaining === null || !Number.isFinite(moneyRemaining)) {
        return {
            status: 'NO_SOLUTION',
            abilityBudget: null,
            abilitySpend: null,
            weaponCost: null,
            armorCost: null,
            weaponName: null,
            armorName: null,
            abilities: null,
            reason: 'missing moneyRemaining',
        };
    }
    const spend = PISTOL_ROUND_CREDITS - moneyRemaining;
    if (!Number.isFinite(spend) || spend < 0) {
        return {
            status: 'NO_SOLUTION',
            abilityBudget: null,
            abilitySpend: null,
            weaponCost: null,
            armorCost: null,
            weaponName: null,
            armorName: null,
            abilities: null,
            reason: 'negative spend',
        };
    }
    const weapon = resolveWeaponCost(input.weapon);
    const armor = resolveArmorCost(input.armor);
    const hasWeapon = weapon.known;
    const hasArmor = armor.known;
    if (hasWeapon && hasArmor) {
        const abilityBudget = spend - (weapon.cost + armor.cost);
        if (abilityBudget < 0) {
            return {
                status: 'NO_SOLUTION',
                abilityBudget,
                abilitySpend: null,
                weaponCost: weapon.cost,
                armorCost: armor.cost,
                weaponName: weapon.name,
                armorName: armor.name,
                abilities: null,
                reason: 'negative abilityBudget',
            };
        }
        const combos = getAbilityCombos(input.agentName, abilityBudget);
        if (combos.length === 1) {
            return {
                status: 'EXACT',
                abilityBudget,
                abilitySpend: combos[0].totalCost,
                weaponCost: weapon.cost,
                armorCost: armor.cost,
                weaponName: weapon.name,
                armorName: armor.name,
                abilities: combos[0].abilities,
            };
        }
        if (combos.length === 0) {
            return {
                status: 'NO_SOLUTION',
                abilityBudget,
                abilitySpend: null,
                weaponCost: weapon.cost,
                armorCost: armor.cost,
                weaponName: weapon.name,
                armorName: armor.name,
                abilities: null,
                reason: 'no ability combos match budget',
            };
        }
        return {
            status: 'AMBIGUOUS',
            abilityBudget,
            abilitySpend: null,
            weaponCost: weapon.cost,
            armorCost: armor.cost,
            weaponName: weapon.name,
            armorName: armor.name,
            abilities: null,
            solutionCount: combos.length,
            sampleSolutions: combos.slice(0, 2).map((combo) => buildAbilityComboString(combo.abilities)),
        };
    }
    if (!input.allowFallback) {
        return {
            status: 'NO_SOLUTION',
            abilityBudget: null,
            abilitySpend: null,
            weaponCost: hasWeapon ? weapon.cost : null,
            armorCost: hasArmor ? armor.cost : null,
            weaponName: weapon.name,
            armorName: armor.name,
            abilities: null,
            reason: 'missing weapon or armor data',
        };
    }
    const fallbackKey = [
        normalizeKey(input.agentName),
        moneyRemaining,
        hasWeapon ? normalizeKey(weapon.name ?? '') : 'weapon:unknown',
        hasArmor ? normalizeKey(armor.name ?? '') : 'armor:unknown',
    ].join('|');
    const cachedFallback = fallbackCache.get(fallbackKey);
    if (cachedFallback)
        return cachedFallback;
    const weaponOptions = hasWeapon
        ? [{ name: weapon.name ?? 'Weapon', cost: weapon.cost }]
        : getPistolLegalWeapons().map((option) => ({ name: option.name, cost: option.cost }));
    const armorOptions = hasArmor
        ? [{ name: armor.name ?? 'No Armor', cost: armor.cost }]
        : [
            { name: 'No Armor', cost: 0 },
            ...getPistolLegalArmor().map((option) => ({ name: option.name, cost: option.cost })),
        ];
    const solutions = [];
    for (const weaponOption of weaponOptions) {
        for (const armorOption of armorOptions) {
            const abilityBudget = spend - (weaponOption.cost + armorOption.cost);
            if (abilityBudget < 0)
                continue;
            const combos = getAbilityCombos(input.agentName, abilityBudget);
            for (const combo of combos) {
                solutions.push({
                    weaponName: weaponOption.name,
                    armorName: armorOption.name,
                    weaponCost: weaponOption.cost,
                    armorCost: armorOption.cost,
                    abilityBudget,
                    combo,
                });
            }
        }
    }
    let fallbackResult;
    if (solutions.length === 1) {
        const solution = solutions[0];
        fallbackResult = {
            status: 'EXACT',
            abilityBudget: solution.abilityBudget,
            abilitySpend: solution.combo.totalCost,
            weaponCost: solution.weaponCost,
            armorCost: solution.armorCost,
            weaponName: solution.weaponName,
            armorName: solution.armorName,
            abilities: solution.combo.abilities,
        };
    }
    else if (solutions.length === 0) {
        fallbackResult = {
            status: 'NO_SOLUTION',
            abilityBudget: null,
            abilitySpend: null,
            weaponCost: hasWeapon ? weapon.cost : null,
            armorCost: hasArmor ? armor.cost : null,
            weaponName: weapon.name,
            armorName: armor.name,
            abilities: null,
            reason: 'no solutions across pistol-legal gear',
        };
    }
    else {
        fallbackResult = {
            status: 'AMBIGUOUS',
            abilityBudget: null,
            abilitySpend: null,
            weaponCost: hasWeapon ? weapon.cost : null,
            armorCost: hasArmor ? armor.cost : null,
            weaponName: weapon.name,
            armorName: armor.name,
            abilities: null,
            solutionCount: solutions.length,
            sampleSolutions: solutions.slice(0, 2).map((solution) => {
                const abilityText = buildAbilityComboString(solution.combo.abilities);
                return `${solution.weaponName} + ${solution.armorName}: ${abilityText}`;
            }),
        };
    }
    fallbackCache.set(fallbackKey, fallbackResult);
    return fallbackResult;
}
function buildSummaryRows(recordsByMapSide) {
    const rows = [];
    const sideOrder = { Attack: 0, Defense: 1, Unknown: 2 };
    const sorted = [...recordsByMapSide.values()].sort((a, b) => {
        const mapCompare = a.map.localeCompare(b.map);
        if (mapCompare !== 0)
            return mapCompare;
        return sideOrder[a.side] - sideOrder[b.side];
    });
    for (const entry of sorted) {
        if (entry.side === 'Unknown') {
            continue;
        }
        const analyzed = entry.records.filter((record) => record.moneyRemaining !== null);
        const exact = entry.records.filter((record) => record.status === 'EXACT');
        const exactRate = analyzed.length > 0 ? ((exact.length / analyzed.length) * 100).toFixed(1) : '0.0';
        const abilityCounts = new Map();
        for (const record of exact) {
            for (const ability of record.abilities ?? []) {
                abilityCounts.set(ability.name, (abilityCounts.get(ability.name) ?? 0) + ability.charges);
            }
        }
        const topAbilities = [...abilityCounts.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, 5)
            .map(([name, count]) => `${name} x${count}`)
            .join(', ') || '--';
        rows.push({
            map: entry.map,
            side: entry.side,
            analyzedCount: analyzed.length,
            exactCount: exact.length,
            exactRate: `${exactRate}%`,
            topAbilities,
        });
    }
    return rows;
}
function buildBehaviorMetrics(recordsByMapSide) {
    const metrics = [];
    const sideOrder = { Attack: 0, Defense: 1, Unknown: 2 };
    const sorted = [...recordsByMapSide.values()].sort((a, b) => {
        const mapCompare = a.map.localeCompare(b.map);
        if (mapCompare !== 0)
            return mapCompare;
        return sideOrder[a.side] - sideOrder[b.side];
    });
    for (const entry of sorted) {
        if (entry.side === 'Unknown') {
            continue;
        }
        const exact = entry.records.filter((record) => record.status === 'EXACT');
        const exactCount = exact.length;
        const avgAbilitySpend = exactCount > 0
            ? exact.reduce((sum, record) => sum + (record.abilitySpend ?? 0), 0) / exactCount
            : null;
        const bundleCounts = new Map();
        for (const record of exact) {
            const key = buildBundleKey(record.abilities ?? []);
            bundleCounts.set(key, (bundleCounts.get(key) ?? 0) + 1);
        }
        const bundles = [...bundleCounts.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([bundle, count]) => ({
            bundle,
            count,
            rate: exactCount > 0 ? count / exactCount : 0,
        }));
        const histogramCounts = HISTOGRAM_BUCKETS.map((bucket) => ({ ...bucket, count: 0 }));
        for (const record of exact) {
            if (record.abilityBudget === null)
                continue;
            const value = record.abilityBudget;
            const bucket = histogramCounts.find((b) => value >= b.min && value <= b.max);
            if (bucket)
                bucket.count += 1;
        }
        const histogram = histogramCounts.map((bucket) => ({
            bucket: bucket.label,
            count: bucket.count,
            rate: exactCount > 0 ? bucket.count / exactCount : 0,
        }));
        metrics.push({
            map: entry.map,
            side: entry.side,
            exactCount,
            avgAbilitySpend,
            bundles,
            histogram,
        });
    }
    return metrics;
}
function formatMatchDate(dateString) {
    if (!dateString)
        return 'Unknown';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime()))
        return 'Unknown';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
export async function buildPistolUtilityExactData(entityType, entityId, matches, filters) {
    const cutoff = new Date('2025-12-31T23:59:59Z');
    const filteredMatches = matches.filter((match) => {
        if (!match.startedAt)
            return true;
        const started = new Date(match.startedAt);
        if (Number.isNaN(started.getTime()))
            return true;
        return started <= cutoff;
    });
    const recordsByMapSide = new Map();
    const roundsByMapSide = {};
    const sidesByMap = {};
    const mapSet = new Set();
    let analyzedCount = 0;
    let exactCount = 0;
    let ambiguousCount = 0;
    let noSolutionCount = 0;
    for (const match of filteredMatches) {
        for (const map of match.maps) {
            if (filters.map && map.mapName.toLowerCase() !== filters.map.toLowerCase()) {
                continue;
            }
            const mapName = formatMapName(map.mapName);
            const round = map.rounds.find((r) => r.roundNumber === 1);
            if (!round)
                continue;
            let teamId = null;
            if (entityType === 'team') {
                teamId = entityId;
            }
            else {
                const entry = round.playerStats.find((ps) => ps.playerId === entityId);
                if (!entry)
                    continue;
                teamId = entry.teamId;
            }
            if (!teamId)
                continue;
            const side = sideLabel(round.side?.[teamId]);
            if (filters.side && filters.side !== 'both') {
                const filterSide = filters.side === 'attacker' ? 'Attack' : 'Defense';
                if (side !== filterSide)
                    continue;
            }
            const snapshot = pickEarliestSnapshot(extractSnapshots(round));
            const snapshotPlayers = snapshot?.players ?? [];
            const snapshotByPlayerId = new Map();
            for (const entry of snapshotPlayers) {
                const playerId = extractPlayerId(entry);
                if (!playerId)
                    continue;
                snapshotByPlayerId.set(playerId, entry);
            }
            const teamPlayers = round.playerStats.filter((ps) => ps.teamId === teamId);
            const players = [];
            for (const ps of teamPlayers) {
                const snapEntry = snapshotByPlayerId.get(ps.playerId);
                const moneyRemaining = extractMoneyRemaining(snapEntry);
                const weaponRef = extractWeaponRef(snapEntry);
                const armorRef = extractArmorRef(snapEntry);
                const inference = inferAbilityPurchasesExact({
                    agentName: ps.agent.name,
                    moneyRemaining,
                    weapon: weaponRef,
                    armor: armorRef,
                    allowFallback: true,
                });
                if (moneyRemaining !== null)
                    analyzedCount += 1;
                if (inference.status === 'EXACT')
                    exactCount += 1;
                if (inference.status === 'AMBIGUOUS')
                    ambiguousCount += 1;
                if (inference.status === 'NO_SOLUTION')
                    noSolutionCount += 1;
                const playerName = ps.playerNickname || ps.playerId;
                const weaponDisplay = (() => {
                    if (typeof weaponRef === 'string')
                        return weaponRef;
                    if (weaponRef && typeof weaponRef === 'object' && weaponRef.name)
                        return weaponRef.name;
                    return inference.weaponName;
                })();
                const armorDisplay = (() => {
                    if (armorRef === null)
                        return 'No Armor';
                    if (typeof armorRef === 'string')
                        return armorRef;
                    if (armorRef && typeof armorRef === 'object' && armorRef.name)
                        return armorRef.name;
                    return inference.armorName;
                })();
                players.push({
                    playerId: ps.playerId,
                    playerName,
                    agent: ps.agent.name,
                    moneyRemaining,
                    weapon: weaponDisplay ?? null,
                    armor: armorDisplay ?? null,
                    status: inference.status,
                    abilityBudget: inference.abilityBudget,
                    abilitySpend: inference.abilitySpend,
                    abilities: inference.abilities,
                    solutionCount: inference.solutionCount,
                    sampleSolutions: inference.sampleSolutions,
                    reason: inference.reason,
                });
            }
            const teamInfo = match.teams.find((t) => t.teamId === teamId);
            const opponentInfo = match.teams.find((t) => t.teamId !== teamId);
            const roundRecord = {
                matchId: match.id,
                matchDate: formatMatchDate(match.startedAt),
                mapName,
                side,
                roundNumber: 1,
                teamId,
                teamName: teamInfo?.teamName ?? teamId,
                opponentName: opponentInfo?.teamName ?? 'Opponent',
                players,
            };
            const mapSideKey = `${mapName}|${side}`;
            if (!recordsByMapSide.has(mapSideKey)) {
                recordsByMapSide.set(mapSideKey, { map: mapName, side, records: [] });
            }
            recordsByMapSide.get(mapSideKey).records.push(...players);
            if (!roundsByMapSide[mapSideKey]) {
                roundsByMapSide[mapSideKey] = [];
            }
            roundsByMapSide[mapSideKey].push(roundRecord);
            if (!sidesByMap[mapName])
                sidesByMap[mapName] = [];
            if (!sidesByMap[mapName].includes(side))
                sidesByMap[mapName].push(side);
            mapSet.add(mapName);
        }
    }
    for (const rounds of Object.values(roundsByMapSide)) {
        rounds.sort((a, b) => {
            const dateA = Date.parse(a.matchDate);
            const dateB = Date.parse(b.matchDate);
            if (!Number.isNaN(dateA) && !Number.isNaN(dateB))
                return dateA - dateB;
            return a.matchId.localeCompare(b.matchId);
        });
    }
    const summary = buildSummaryRows(recordsByMapSide);
    const behavior = buildBehaviorMetrics(recordsByMapSide);
    const maps = [...mapSet].sort((a, b) => a.localeCompare(b));
    return {
        summary,
        drilldown: {
            maps,
            sidesByMap,
            roundsByMapSide,
        },
        behavior,
        meta: {
            analyzedCount,
            exactCount,
            ambiguousCount,
            noSolutionCount,
        },
    };
}
// ============================================================
// Team-Level Pistol Loadout Analysis (uses GRID team economy)
// ============================================================
const LOADOUT_BUCKETS = [
    { label: '0-1000', min: 0, max: 1000 },
    { label: '1001-1500', min: 1001, max: 1500 },
    { label: '1501-2000', min: 1501, max: 2000 },
    { label: '2001-2500', min: 2001, max: 2500 },
    { label: '2501-3000', min: 2501, max: 3000 },
    { label: '3001-3500', min: 3001, max: 3500 },
    { label: '3501-4000', min: 3501, max: 4000 },
];
function getPistolSide(sideStr) {
    if (sideStr === 'attacker')
        return 'Attack';
    if (sideStr === 'defender')
        return 'Defense';
    return null;
}
function formatMatchDateShort(dateString) {
    if (!dateString)
        return 'Unknown';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime()))
        return 'Unknown';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
export function buildPistolLoadoutData(entityType, entityId, matches, filters) {
    const rounds = [];
    const roundsByMapSide = {};
    const mapSideStats = new Map();
    for (const match of matches) {
        for (const map of match.maps) {
            if (filters.map && map.mapName.toLowerCase() !== filters.map.toLowerCase()) {
                continue;
            }
            const mapName = formatMapName(map.mapName);
            // Find pistol rounds (round 1 and round 13 for second half)
            const pistolRounds = map.rounds.filter(r => r.roundNumber === 1 || r.roundNumber === 13);
            for (const round of pistolRounds) {
                // Determine team ID based on entity type
                let teamId = null;
                if (entityType === 'team') {
                    teamId = entityId;
                }
                else {
                    // For player, find their team from playerStats
                    const playerEntry = round.playerStats.find(ps => ps.playerId === entityId);
                    if (!playerEntry)
                        continue;
                    teamId = playerEntry.teamId;
                }
                if (!teamId)
                    continue;
                // Get side for the team
                const sideStr = round.side?.[teamId];
                const side = getPistolSide(sideStr);
                if (!side)
                    continue;
                // Apply side filter
                if (filters.side && filters.side !== 'both') {
                    const filterSide = filters.side === 'attacker' ? 'Attack' : 'Defense';
                    if (side !== filterSide)
                        continue;
                }
                // Get team loadout from economy data
                const teamEcon = round.economy.find(e => e.teamId === teamId);
                const opponentEcon = round.economy.find(e => e.teamId !== teamId);
                if (!teamEcon)
                    continue;
                const teamLoadout = teamEcon.loadoutValue;
                const opponentLoadout = opponentEcon?.loadoutValue ?? 0;
                const won = round.winnerId === teamId;
                // Get team and opponent names from match
                const teamInfo = match.teams.find(t => t.teamId === teamId);
                const opponentInfo = match.teams.find(t => t.teamId !== teamId);
                // Get agents used by the team this round
                const agents = round.playerStats
                    .filter(ps => ps.teamId === teamId)
                    .map(ps => ps.agent.name);
                const record = {
                    matchId: match.id,
                    matchDate: formatMatchDateShort(match.startedAt),
                    mapName,
                    roundNumber: round.roundNumber,
                    side,
                    teamId,
                    teamName: teamInfo?.teamName ?? teamId,
                    opponentName: opponentInfo?.teamName ?? 'Opponent',
                    teamLoadout,
                    opponentLoadout,
                    won,
                    agents,
                };
                rounds.push(record);
                // Group by map|side
                const key = `${mapName}|${side}`;
                if (!roundsByMapSide[key]) {
                    roundsByMapSide[key] = [];
                }
                roundsByMapSide[key].push(record);
                // Accumulate stats
                if (!mapSideStats.has(key)) {
                    mapSideStats.set(key, { map: mapName, side, loadouts: [], wins: 0, losses: 0 });
                }
                const stats = mapSideStats.get(key);
                stats.loadouts.push(teamLoadout);
                if (won)
                    stats.wins++;
                else
                    stats.losses++;
            }
        }
    }
    // Sort rounds by date
    rounds.sort((a, b) => {
        const dateA = Date.parse(a.matchDate);
        const dateB = Date.parse(b.matchDate);
        if (!Number.isNaN(dateA) && !Number.isNaN(dateB))
            return dateB - dateA; // Most recent first
        return b.matchId.localeCompare(a.matchId);
    });
    for (const roundList of Object.values(roundsByMapSide)) {
        roundList.sort((a, b) => {
            const dateA = Date.parse(a.matchDate);
            const dateB = Date.parse(b.matchDate);
            if (!Number.isNaN(dateA) && !Number.isNaN(dateB))
                return dateB - dateA;
            return b.matchId.localeCompare(a.matchId);
        });
    }
    // Build summary
    const summary = [];
    const sideOrder = { Attack: 0, Defense: 1 };
    const sortedStats = [...mapSideStats.values()].sort((a, b) => {
        const mapCmp = a.map.localeCompare(b.map);
        if (mapCmp !== 0)
            return mapCmp;
        return sideOrder[a.side] - sideOrder[b.side];
    });
    for (const stat of sortedStats) {
        const total = stat.loadouts.length;
        const avg = total > 0 ? stat.loadouts.reduce((a, b) => a + b, 0) / total : 0;
        const min = total > 0 ? Math.min(...stat.loadouts) : 0;
        const max = total > 0 ? Math.max(...stat.loadouts) : 0;
        const winRate = total > 0 ? stat.wins / total : 0;
        summary.push({
            map: stat.map,
            side: stat.side,
            roundCount: total,
            avgLoadout: Math.round(avg),
            minLoadout: min,
            maxLoadout: max,
            winRate,
            wins: stat.wins,
            losses: stat.losses,
        });
    }
    // Build histogram across all rounds
    const histogram = LOADOUT_BUCKETS.map(bucket => ({
        range: bucket.label,
        min: bucket.min,
        max: bucket.max,
        count: 0,
        wins: 0,
        winRate: 0,
    }));
    for (const record of rounds) {
        const bucket = histogram.find(b => record.teamLoadout >= b.min && record.teamLoadout <= b.max);
        if (bucket) {
            bucket.count++;
            if (record.won)
                bucket.wins++;
        }
    }
    // Calculate win rates per bucket
    for (const bucket of histogram) {
        bucket.winRate = bucket.count > 0 ? bucket.wins / bucket.count : 0;
    }
    // Meta stats
    const totalRounds = rounds.length;
    const avgLoadout = totalRounds > 0
        ? Math.round(rounds.reduce((sum, r) => sum + r.teamLoadout, 0) / totalRounds)
        : 0;
    const totalWins = rounds.filter(r => r.won).length;
    const overallWinRate = totalRounds > 0 ? totalWins / totalRounds : 0;
    return {
        summary,
        rounds,
        roundsByMapSide,
        histogram,
        meta: {
            totalRounds,
            avgLoadout,
            overallWinRate,
        },
    };
}
