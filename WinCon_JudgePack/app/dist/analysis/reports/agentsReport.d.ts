import type { Report, ReportFilters } from '../../data/models/index.js';
export declare function generateAgentsReport(entityType: 'team' | 'player', entityId: string, filters: ReportFilters): Promise<Report>;
