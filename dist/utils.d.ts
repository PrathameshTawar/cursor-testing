export type PromptSummary = {
    source: string;
    summary: string;
    timestamp: string;
    relatedFiles: string[];
};
export declare function normalizePath(value: string): string;
export declare function joinPath(...segments: string[]): string;
export declare function isBlockedFilename(filePath: string, blockedPatterns: string[]): boolean;
export declare function fileMatchesPatterns(filePath: string, patterns: string[]): boolean;
export declare function truncateText(value: string, maxLength: number): string;
export declare function looksLikeSecret(line: string): boolean;
export declare function scrubPromptText(value: string): string;
export declare function safeExtractStrings(input: unknown): string[];
export declare function extractPromptSummariesFromJson(json: unknown, source: string): PromptSummary[];
