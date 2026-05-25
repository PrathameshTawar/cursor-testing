"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CursorReaderMCPServer = void 0;
const http_1 = __importDefault(require("http"));
const workspaceTools_1 = require("./workspaceTools");
class CursorReaderMCPServer {
    constructor(config) {
        this.config = config;
        this.workspaceTools = new workspaceTools_1.CursorWorkspaceTools(config);
    }
    async start(port = this.config.serverPort) {
        await this.workspaceTools.initialize();
        this.server = http_1.default.createServer(async (req, res) => {
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
                const payload = JSON.parse(body);
                const result = await this.dispatch(payload.tool, payload.params ?? {});
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: true, result }));
            }
            catch (error) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        await new Promise((resolve, reject) => {
            this.server?.listen(port, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }
    async stop() {
        await this.workspaceTools.shutdown();
        if (this.server) {
            await new Promise((resolve) => this.server?.close(() => resolve()));
            this.server = undefined;
        }
    }
    async dispatch(tool, params) {
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
                    fileExtensions: Array.isArray(params.fileExtensions) ? params.fileExtensions : undefined,
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
    collectRequestBody(request) {
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
exports.CursorReaderMCPServer = CursorReaderMCPServer;
//# sourceMappingURL=mcpServer.js.map