import 'dotenv/config';
export declare function queryGrid<T>(query: string, variables?: Record<string, unknown>): Promise<T>;
export declare function queryGridState<T>(query: string, variables?: Record<string, unknown>): Promise<T>;
export declare function queryGridStats<T>(query: string, variables?: Record<string, unknown>): Promise<T>;
export type VctRegion = 'Americas' | 'EMEA' | 'Pacific' | 'China';
export interface VctTeam {
    name: string;
    shortName: string;
    region: VctRegion;
}
export declare const VCT_TEAMS: VctTeam[];
export declare function getVctTeamsByRegion(region: VctRegion): VctTeam[];
export declare function findVctTeam(name: string): VctTeam | undefined;
export declare function vctRegionToRegion(vctRegion: VctRegion): 'NA' | 'EMEA' | 'APAC' | 'CN';
export declare function getTeamRegion(teamName: string): 'NA' | 'EMEA' | 'APAC' | 'CN' | undefined;
export declare const QUERIES: {
    getSeriesState: string;
    getSeriesStateBase: string;
    getSeriesStateBaseNoObjectives: string;
    getSeriesStatisticsObjectives: string;
    getSeriesStatisticsObjectivesAlt: string;
    getSeriesFull: string;
    getSeries: string;
    searchTeams: string;
    getTeamPlayers: string;
    getTeamMatches: string;
    searchPlayers: string;
    getTeam: string;
    listTeamsPaginated: string;
    listRecentSeries: string;
};
export declare function isApiConfigured(): boolean;
