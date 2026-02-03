import type { Report, ReportFilters } from '../../data/models/index.js';
export declare function generatePistolReport(entityType: 'team' | 'player', entityId: string, filters: ReportFilters): Promise<Report>;
