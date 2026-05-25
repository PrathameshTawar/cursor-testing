import { CursorReaderConfig } from "./config";
import { ProjectSummary, ProjectTreeNode } from "./workspaceTools";
import { CodeSearchResult } from "./search";
import { FileEvent } from "./changeStore";
import { GitDiffEntry } from "./gitTracker";
import { PromptSummary } from "./utils";
export type ToolResult = ProjectSummary[] | ProjectTreeNode | string | CodeSearchResult[] | FileEvent[] | GitDiffEntry[] | PromptSummary[];
export declare class CursorReaderMCPServer {
    private config;
    private server?;
    private workspaceTools;
    constructor(config: CursorReaderConfig);
    start(port?: number): Promise<void>;
    stop(): Promise<void>;
    dispatch(tool: string, params: Record<string, unknown>): Promise<ToolResult>;
    private collectRequestBody;
}
