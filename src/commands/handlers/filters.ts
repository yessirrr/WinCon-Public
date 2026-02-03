import type { ParsedCommand } from '../parser.js';
import { useStore } from '../../ui/context/store.js';

const VALID_MAPS = [
  'ascent', 'bind', 'breeze', 'fracture', 'haven',
  'icebox', 'lotus', 'pearl', 'split', 'sunset', 'abyss',
];

const VALID_SIDES = ['attacker', 'defender', 'both', 'a', 'd', 'atk', 'def'];

export async function handleFilter(cmd: ParsedCommand): Promise<void> {
  const store = useStore.getState();

  if (cmd.name !== 'set') {
    throw new Error(`Unknown filter command: /${cmd.name}`);
  }

  if (cmd.args.length < 2) {
    throw new Error('Usage: /set <window|map|side> <value>');
  }

  const [key, ...valueParts] = cmd.args;
  const value = valueParts.join(' ').toLowerCase();

  switch (key.toLowerCase()) {
    case 'window': {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1 || num > 50) {
        throw new Error('Window must be a number between 1 and 50');
      }
      store.setFilter('window', num);
      break;
    }

    case 'map': {
      if (value === 'all' || value === 'any') {
        store.setFilter('map', undefined);
      } else if (!VALID_MAPS.includes(value)) {
        throw new Error(`Invalid map: ${value}. Valid maps: ${VALID_MAPS.join(', ')}`);
      } else {
        // Capitalize first letter
        const mapName = value.charAt(0).toUpperCase() + value.slice(1);
        store.setFilter('map', mapName);
      }
      break;
    }

    case 'side': {
      if (!VALID_SIDES.includes(value)) {
        throw new Error('Side must be: attacker, defender, or both');
      }
      let side: 'attacker' | 'defender' | 'both';
      if (value === 'a' || value === 'atk' || value === 'attacker') {
        side = 'attacker';
      } else if (value === 'd' || value === 'def' || value === 'defender') {
        side = 'defender';
      } else {
        side = 'both';
      }
      store.setFilter('side', side);
      break;
    }

    default:
      throw new Error(`Unknown filter: ${key}. Valid filters: window, map, side`);
  }
}
