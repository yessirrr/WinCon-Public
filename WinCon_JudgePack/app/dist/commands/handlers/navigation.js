import { useStore } from '../../ui/context/store.js';
import { searchTeamByName, searchPlayerByName, getMatchById } from '../../data/index.js';
export async function handleNavigation(cmd) {
    const store = useStore.getState();
    switch (cmd.name) {
        case 'home':
            store.goHome();
            break;
        case 'back':
            store.goBack();
            break;
        case 'team': {
            if (cmd.args.length === 0) {
                throw new Error('Usage: /team <name>');
            }
            const teamName = cmd.args.join(' ');
            store.setLoading(true);
            try {
                const team = await searchTeamByName(teamName);
                if (!team) {
                    throw new Error(`Team not found: ${teamName}`);
                }
                store.setSelectedTeam(team.id);
                store.navigate('team-page', { teamId: team.id, teamName });
            }
            finally {
                store.setLoading(false);
            }
            break;
        }
        case 'player': {
            if (cmd.args.length === 0) {
                throw new Error('Usage: /player <name>');
            }
            const playerName = cmd.args.join(' ');
            store.setLoading(true);
            try {
                const player = await searchPlayerByName(playerName);
                if (!player) {
                    throw new Error(`Player not found: ${playerName}`);
                }
                store.setSelectedPlayer(player.id);
                store.navigate('player-page', { playerId: player.id });
            }
            finally {
                store.setLoading(false);
            }
            break;
        }
        case 'match': {
            if (cmd.args.length === 0) {
                throw new Error('Usage: /match <id>');
            }
            const matchId = cmd.args[0];
            store.setLoading(true);
            try {
                const match = await getMatchById(matchId);
                if (!match) {
                    throw new Error(`Match not found: ${matchId}`);
                }
                store.navigate('match-page', { matchId: match.id });
            }
            finally {
                store.setLoading(false);
            }
            break;
        }
        default:
            throw new Error(`Unknown navigation command: /${cmd.name}`);
    }
}
