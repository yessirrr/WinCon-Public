import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { SelectList, Loading } from '../components/index.js';
import { useStore } from '../context/store.js';
import { searchPlayers, searchPlayerByName } from '../../data/index.js';
export function PlayerFinderScreen() {
    const navigate = useStore((s) => s.navigate);
    const setSelectedPlayer = useStore((s) => s.setSelectedPlayer);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (query.length < 2) {
            setResults([]);
            setHasSearched(false);
            setError(null);
            return;
        }
        const search = async () => {
            setSearching(true);
            setError(null);
            try {
                const data = await searchPlayers(query);
                setResults(data);
                setHasSearched(true);
            }
            catch (err) {
                setError(err instanceof Error ? err.message : 'Search failed');
                setResults([]);
            }
            finally {
                setSearching(false);
            }
        };
        const debounce = setTimeout(search, 300);
        return () => clearTimeout(debounce);
    }, [query]);
    const [selecting, setSelecting] = useState(false);
    const items = results.map((player) => ({
        label: `${player.name} (${player.teamName})`,
        value: player,
    }));
    const handleSelect = async (item) => {
        setSelecting(true);
        try {
            // Look up player with historical team (as of cutoff date)
            const player = await searchPlayerByName(item.value.name);
            if (player) {
                setSelectedPlayer(player.id);
                navigate('player-page', { playerId: player.id, playerName: player.name });
            }
            else {
                // Fallback to the search result
                setSelectedPlayer(item.value.id);
                navigate('player-page', { playerId: item.value.id, playerName: item.value.name });
            }
        }
        catch {
            // Fallback on error
            setSelectedPlayer(item.value.id);
            navigate('player-page', { playerId: item.value.id, playerName: item.value.name });
        }
    };
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Text, { bold: true, children: "Find a Player" }), _jsxs(Box, { marginY: 1, children: [_jsx(Text, { color: "gray", children: "Search: " }), _jsx(TextInput, { value: query, onChange: setQuery, placeholder: "Enter player name..." })] }), (searching || selecting) && (_jsx(Loading, { message: selecting ? "Loading player..." : "Searching GRID..." })), error && (_jsxs(Text, { color: "red", children: ["Error: ", error] })), !searching && !selecting && !error && hasSearched && results.length === 0 && (_jsxs(Text, { color: "gray", children: ["No players found for \"", query, "\""] })), !searching && !selecting && !error && results.length > 0 && (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { color: "gray", children: ["Found ", results.length, " player(s):"] }), _jsx(Box, { marginTop: 1, children: _jsx(SelectList, { items: items, onSelect: handleSelect }) })] }))] }));
}
