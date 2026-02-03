import type { Report, ReportFilters } from '../../data/models/index.js';
export declare function generateEconomyReport(entityType: 'team' | 'player', entityId: string, filters: ReportFilters): Promise<Report>;
