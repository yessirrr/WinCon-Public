export interface Team {
    id: string;
    name: string;
    shortName: string;
    region: Region;
    logoUrl?: string;
    players: Player[];
}
export interface Player {
    id: string;
    name: string;
    realName?: string;
    teamId: string;
    teamName: string;
    region: Region;
    role?: PlayerRole;
}
export type Region = 'NA' | 'EMEA' | 'APAC' | 'CN' | 'LATAM';
export type PlayerRole = 'duelist' | 'initiator' | 'controller' | 'sentinel' | 'flex';
export interface Match {
    id: string;
    seriesId: string;
    tournament: Tournament;
    teams: MatchTeam[];
    maps: MapResult[];
    startedAt: string;
    completedAt?: string;
    winner?: string;
}
export interface Tournament {
    id: string;
    name: string;
    region: Region;
}
export interface MatchTeam {
    teamId: string;
    teamName: string;
    score: number;
}
export interface MapResult {
    mapName: string;
    mapNumber: number;
    gameId?: string;
    teamStats: MapTeamStats[];
    rounds: Round[];
    winner?: string;
}
export interface MapTeamStats {
    teamId: string;
    score: number;
    attackRoundsWon: number;
    defenseRoundsWon: number;
}
export interface Round {
    roundNumber: number;
    winnerId: string;
    winType: WinType;
    side: Record<string, 'attacker' | 'defender'>;
    economy: RoundEconomy[];
    playerStats: RoundPlayerStats[];
    playerEconomySnapshots?: RoundEconomySnapshot[];
    duration?: string;
    plantOccurred?: boolean;
    plantTimestamp?: string | number | null;
    plantTimeSec?: number | null;
}
export type WinType = 'elimination' | 'spike_detonation' | 'spike_defuse' | 'time_expired';
export interface RoundEconomy {
    teamId: string;
    loadoutValue: number;
    spent: number;
    bankRemaining: number;
    equipmentType: EquipmentType;
}
export type EquipmentType = 'pistol' | 'eco' | 'semi-buy' | 'full-buy';
export interface RoundPlayerStats {
    playerId: string;
    playerNickname?: string;
    teamId: string;
    agent: Agent;
    kills: number;
    deaths: number;
    assists: number;
    damageDealt: number;
    firstKill: boolean;
    firstDeath: boolean;
    clutchAttempt: boolean;
    clutchWin: boolean;
    ability: AbilityUsage;
}
export interface RoundEconomySnapshot {
    timestamp?: string | number | null;
    players: RoundPlayerEconomy[];
}
export interface RoundPlayerEconomy {
    playerId: string;
    playerName?: string;
    teamId: string;
    money?: number | null;
    loadoutValue?: number | null;
    netWorth?: number | null;
    totalMoneyEarned?: number | null;
    weapon?: {
        id?: string;
        name?: string;
    } | null;
    armor?: {
        id?: string;
        name?: string;
    } | null;
}
export interface AbilityUsage {
    casts: number;
    kills: number;
    damageDealt: number;
}
export interface Agent {
    id: string;
    name: string;
    role: AgentRole;
}
export type AgentRole = 'Duelist' | 'Initiator' | 'Controller' | 'Sentinel';
export type ReportType = 'pistol' | 'overview' | 'matches' | 'wincon';
export interface Report {
    type: ReportType;
    title: string;
    entityType: 'team' | 'player';
    entityId: string;
    entityName: string;
    generatedAt: string;
    filters: ReportFilters;
    sections: ReportSection[];
}
export interface ReportFilters {
    window?: number;
    map?: string;
    side?: 'attacker' | 'defender' | 'both';
}
export interface ReportSection {
    heading: string;
    content: ReportContent;
}
export type ReportContent = {
    type: 'text';
    value: string;
} | {
    type: 'collapsible-text';
    value: string;
    hotkey: string;
    label: string;
} | {
    type: 'bullets';
    items: string[];
} | {
    type: 'table';
    headers: string[];
    rows: string[][];
} | {
    type: 'stat';
    label: string;
    value: string | number;
    unit?: string;
} | {
    type: 'momentum';
    data: unknown;
} | {
    type: 'econ-intel';
    data: unknown;
};
export interface PlayerStats {
    totalKills: number;
    totalDeaths: number;
    totalAssists: number;
    totalDamage: number;
    roundsPlayed: number;
    kd: number;
    adr: number;
    kda: number;
    agents: {
        name: string;
        mapsPlayed: number;
        wins: number;
        losses: number;
    }[];
    attackRoundsWon: number;
    attackRoundsPlayed: number;
    defenseRoundsWon: number;
    defenseRoundsPlayed: number;
    matchesAnalyzed: number;
    mapsAnalyzed: number;
}
export type ScreenType = 'landing' | 'region-select-team' | 'region-select-player' | 'team-list' | 'player-finder' | 'team-page' | 'player-page' | 'match-page' | 'report-view';
export interface ScreenParams {
    teamId?: string;
    teamName?: string;
    playerId?: string;
    playerName?: string;
    matchId?: string;
    region?: string;
}
export interface HistoryEntry {
    screen: ScreenType;
    params: ScreenParams | null;
}
