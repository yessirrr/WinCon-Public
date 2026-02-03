import type { ParsedCommand } from '../parser.js';
import { useStore } from '../../ui/context/store.js';
import { exportToMarkdown } from '../../rendering/exporters/markdownExporter.js';
import { clearAllCaches } from '../../data/index.js';

export async function handleSystem(cmd: ParsedCommand): Promise<void> {
  const store = useStore.getState();

  switch (cmd.name) {
    case 'help':
      store.toggleHelp();
      break;

    case 'export': {
      const report = store.currentReport;
      if (!report) {
        throw new Error('No report to export. Generate a report first.');
      }
      await exportToMarkdown(report);
      break;
    }

    case 'refresh':
      // Clear caches and trigger refetch of current data
      clearAllCaches();
      store.triggerRefresh();
      store.setError(null);
      break;

    case 'quit':
    case 'exit':
      process.exit(0);

    default:
      throw new Error(`Unknown command: /${cmd.name}. Type /help for available commands.`);
  }
}
