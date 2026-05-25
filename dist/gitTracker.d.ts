import { CursorReaderConfig } from "./config";
export interface GitChangeSummary {
    path: string;
    status: string;
}
export interface GitDiffEntry {
    path: string;
    diff: string;
}
export declare class GitTracker {
    private config;
    constructor(config: CursorReaderConfig);
    findGitRoot(filePath: string): string | null;
    listGitChangedFiles(rootPath: string): Promise<GitChangeSummary[]>;
    getLatestGitDiff(rootPath: string): Promise<GitDiffEntry[]>;
    private describeStatus;
}
