export interface ParsedCommand {
    name: string;
    args: string[];
    raw: string;
}
export declare function parseCommand(input: string): ParsedCommand | null;
export type CommandType = 'navigation' | 'report' | 'filter' | 'system';
export declare function classifyCommand(name: string): CommandType;
