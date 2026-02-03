export function parseCommand(input) {
    const trimmed = input.trim();
    // Commands must start with /
    if (!trimmed.startsWith('/')) {
        return null;
    }
    // Remove the leading /
    const withoutSlash = trimmed.slice(1);
    // Split into parts
    const parts = withoutSlash.split(/\s+/);
    if (parts.length === 0 || parts[0] === '') {
        return null;
    }
    const [name, ...args] = parts;
    return {
        name: name.toLowerCase(),
        args,
        raw: trimmed,
    };
}
export function classifyCommand(name) {
    const navigation = ['home', 'back', 'team', 'player', 'match'];
    const report = ['pistol', 'overview', 'matches', 'wincon'];
    const filter = ['set'];
    const system = ['help', 'export', 'refresh', 'quit', 'exit'];
    if (navigation.includes(name))
        return 'navigation';
    if (report.includes(name))
        return 'report';
    if (filter.includes(name))
        return 'filter';
    if (system.includes(name))
        return 'system';
    return 'system'; // Default to system for unknown commands
}
