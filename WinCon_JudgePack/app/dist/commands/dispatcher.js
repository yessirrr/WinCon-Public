import { parseCommand, classifyCommand } from './parser.js';
import { handleNavigation } from './handlers/navigation.js';
import { handleReport } from './handlers/reports.js';
import { handleFilter } from './handlers/filters.js';
import { handleSystem } from './handlers/system.js';
export async function dispatchCommand(input) {
    const parsed = parseCommand(input);
    if (!parsed) {
        throw new Error('Invalid command format. Commands must start with /');
    }
    const type = classifyCommand(parsed.name);
    switch (type) {
        case 'navigation':
            await handleNavigation(parsed);
            break;
        case 'report':
            await handleReport(parsed);
            break;
        case 'filter':
            await handleFilter(parsed);
            break;
        case 'system':
            await handleSystem(parsed);
            break;
        default:
            throw new Error(`Unknown command: /${parsed.name}`);
    }
}
