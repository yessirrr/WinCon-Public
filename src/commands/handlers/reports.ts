import type { ParsedCommand } from '../parser.js';
import { useStore } from '../../ui/context/store.js';
import { generatePistolReport } from '../../analysis/reports/pistolReport.js';
import { generateOverviewReport } from '../../analysis/reports/overviewReport.js';
import { generateWinconReport } from '../../analysis/reports/winconReport.js';
import { getPlayerById, searchTeamByName } from '../../data/index.js';
import type { Report } from '../../data/models/index.js';

/**
 * Resolve team ID from command args or fall back to store state.
 * If args contain a team name, look it up and update the store.
 * The team argument is the source of truth when provided.
 */
async function resolveTeamId(cmd: ParsedCommand): Promise<string | null> {
  const store = useStore.getState();

  // If team name provided in args, use it as source of truth
  if (cmd.args.length > 0) {
    const teamName = cmd.args.join(' ');
    const team = await searchTeamByName(teamName);
    if (!team) {
      throw new Error(`Team not found: ${teamName}`);
    }
    // Update store to reflect the new team selection
    store.setSelectedTeam(team.id);
    return team.id;
  }

  // Fall back to currently selected team
  return store.selectedTeamId;
}

export async function handleReport(cmd: ParsedCommand): Promise<void> {
  const store = useStore.getState();

  let report: Report;

  switch (cmd.name) {
    case 'pistol':
      {
        // Resolve team from args or store
        const teamId = await resolveTeamId(cmd);
        if (!teamId && !store.selectedPlayerId) {
          throw new Error('No team or player selected. Navigate to a team or player first, or specify: /pistol <team>');
        }
        const entityType = teamId ? 'team' : 'player';
        const entityId = teamId || store.selectedPlayerId!;
        const filters = store.getActiveFilters();
        report = await generatePistolReport(entityType, entityId, filters);
        break;
      }

    case 'overview':
      {
        // Resolve team from args or store
        let teamId = await resolveTeamId(cmd);
        if (!teamId && store.selectedPlayerId) {
          const player = await getPlayerById(store.selectedPlayerId);
          teamId = player?.teamId ?? null;
        }
        if (!teamId) {
          throw new Error('No team available for /overview. Select a team first or specify: /overview <team>');
        }
        report = await generateOverviewReport('team', teamId, store.filters.teamFilters);
      }
      break;

    case 'wincon': {
      // Resolve team from args or store
      const teamId = await resolveTeamId(cmd);
      if (!teamId) {
        throw new Error('Select a team before running /wincon, or specify: /wincon <team>');
      }
      report = await generateWinconReport(teamId, store.filters.teamFilters);
      break;
    }

    default:
      throw new Error(`Unknown report command: /${cmd.name}`);
  }

  store.setReport(report);
  store.navigate('report-view');
}
