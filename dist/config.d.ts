export interface CursorReaderConfig {
    allowedRoots: string[];
    ignorePatterns: string[];
    blockedFilePatterns: string[];
    maxRecentChanges: number;
    storeDirectory: string;
    promptScanMaxBytes: number;
    serverPort: number;
}
export declare function buildDefaultConfig(): CursorReaderConfig;
export declare function normalizeConfigPaths(config: CursorReaderConfig): CursorReaderConfig;
