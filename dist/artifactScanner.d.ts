import { CursorReaderConfig } from "./config";
import { SafeFs } from "./safeFs";
import { PromptSummary } from "./utils";
export declare class CursorArtifactScanner {
    private config;
    private safeFs;
    constructor(config: CursorReaderConfig, safeFs: SafeFs);
    scanArtifacts(): Promise<PromptSummary[]>;
    getPromptHistory(): Promise<PromptSummary[]>;
    private scanCursorDirectory;
    private scanWorkspaceStorage;
    private scanStateDatabases;
    private findStateDatabaseFiles;
    private tryParseSqlite;
}
