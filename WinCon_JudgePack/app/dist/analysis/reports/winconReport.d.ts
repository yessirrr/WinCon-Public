import type { Report, ReportFilters } from '../../data/models/index.js';
export declare function generateWinconReport(teamId: string, filters: ReportFilters): Promise<Report>;
