import { CursorReaderConfig } from "./config";
import { GitDiffEntry } from "./gitTracker";
import { CodeSearchResult } from "./search";
import { FileEvent } from "./changeStore";
import { PromptSummary } from "./utils";
export interface ProjectSummary {
    root: string;
    gitRoot: string | null;
    active: boolean;
}
export interface ProjectTreeNode {
    path: string;
    name: string;
    type: "file" | "directory";
    children?: ProjectTreeNode[];
}
export declare class CursorWorkspaceTools {
    private config;
    private safeFs;
    private changeStore;
    private watcher;
    private gitTracker;
    private searcher;
    private artifactScanner;
    constructor(config?: CursorReaderConfig);
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    listProjects(): ProjectSummary[];
    getProjectTree(rootPath: string, maxDepth?: number): Promise<ProjectTreeNode>;
    readFile(filePath: string): Promise<string>;
    searchCode(query: string, options?: {
        caseSensitive?: boolean;
        fileExtensions?: string[];
    }): Promise<CodeSearchResult[]>;
    getRecentChanges(limit?: number): FileEvent[];
    getLatestGitDiff(rootPath?: string): Promise<GitDiffEntry[]>;
    getPromptHistory(): Promise<PromptSummary[]>;
    private buildTree;
}
