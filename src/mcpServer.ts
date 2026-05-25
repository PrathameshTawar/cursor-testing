import http from "http";
import { CursorReaderConfig } from "./config";
import { CursorWorkspaceTools, ProjectSummary, ProjectTreeNode } from "./workspaceTools";
import { CodeSearchResult } from "./search";
import { FileEvent } from "./changeStore";
import { GitDiffEntry } from "./gitTracker";
import { PromptSummary } from "./utils";

export type ToolResult =
  | ProjectSummary[]
  | ProjectTreeNode
  | string
  | CodeSearchResult[]
  | FileEvent[]
  | GitDiffEntry[]
  | PromptSummary[];

export class CursorReaderMCPServer {
  private server?: http.Server;
  private workspaceTools: CursorWorkspaceTools;

  constructor(private config: CursorReaderConfig) {
    this.workspaceTools = new CursorWorkspaceTools(config);
  }

  async start(port = this.config.serverPort): Promise<void> {
    await this.workspaceTools.initialize();
    this.server = http.createServer(async (req, res) => {
      if (!req.url || !req.method) {
        res.statusCode = 400;
        res.end("Invalid request");
        return;
      }

      if (req.method === "GET" && req.url === "/tools") {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ tools: ["list_projects", "get_project_tree", "read_file", "search_code", "get_recent_changes", "get_latest_git_diff", "get_prompt_history"] }));
        return;
      }

      if (req.method !== "POST" || req.url !== "/rpc") {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }

      const body = await this.collectRequestBody(req);
      try {
        const payload = JSON.parse(body) as { tool: string; params?: Record<string, unknown> };
        const result = await this.dispatch(payload.tool, payload.params ?? {});
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: true, result }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      }
    });
    await new Promise<void>((resolve, reject) => {
      this.server?.listen(port, (err?: Error) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    await this.workspaceTools.shutdown();
    if (this.server) {
      await new Promise<void>((resolve) => this.server?.close(() => resolve()));
      this.server = undefined;
    }
  }

  async dispatch(tool: string, params: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      case "list_projects":
        return this.workspaceTools.listProjects();
      case "get_project_tree":
        return this.workspaceTools.getProjectTree(String(params.rootPath || this.config.allowedRoots[0]), Number(params.maxDepth || 4));
      case "read_file":
        return this.workspaceTools.readFile(String(params.path));
      case "search_code":
        return this.workspaceTools.searchCode(String(params.query), {
          caseSensitive: Boolean(params.caseSensitive),
          fileExtensions: Array.isArray(params.fileExtensions) ? (params.fileExtensions as string[]) : undefined,
        });
      case "get_recent_changes":
        return this.workspaceTools.getRecentChanges(Number(params.limit || this.config.maxRecentChanges));
      case "get_latest_git_diff":
        return this.workspaceTools.getLatestGitDiff(params.rootPath ? String(params.rootPath) : undefined);
      case "get_prompt_history":
        return this.workspaceTools.getPromptHistory();
      default:
        throw new Error(`Unknown tool: ${tool}`);
    }
  }

  private collectRequestBody(request: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = "";
      request.on("data", (chunk) => {
        body += chunk.toString();
      });
      request.on("end", () => resolve(body));
      request.on("error", (error) => reject(error));
    });
  }
}
