"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CursorWorkspaceTools = void 0;
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
const safeFs_1 = require("./safeFs");
const changeStore_1 = require("./changeStore");
const watcher_1 = require("./watcher");
const gitTracker_1 = require("./gitTracker");
const search_1 = require("./search");
const artifactScanner_1 = require("./artifactScanner");
const utils_1 = require("./utils");
class CursorWorkspaceTools {
    constructor(config) {
        this.config = (0, config_1.normalizeConfigPaths)(config || (0, config_1.buildDefaultConfig)());
        this.safeFs = new safeFs_1.SafeFs(this.config);
        this.changeStore = new changeStore_1.ChangeStore(this.config);
        this.gitTracker = new gitTracker_1.GitTracker(this.config);
        this.searcher = new search_1.CodeSearcher(this.config, this.safeFs);
        this.artifactScanner = new artifactScanner_1.CursorArtifactScanner(this.config, this.safeFs);
        this.watcher = new watcher_1.CursorWatcher(this.config, this.safeFs, this.changeStore);
    }
    async initialize() {
        await this.watcher.start();
    }
    async shutdown() {
        await this.watcher.stop();
    }
    listProjects() {
        return this.config.allowedRoots.map((root) => ({
            root: path_1.default.resolve(root),
            gitRoot: this.gitTracker.findGitRoot(root),
            active: true,
        }));
    }
    async getProjectTree(rootPath, maxDepth = 4) {
        const resolvedRoot = this.safeFs.validatePath(rootPath);
        return this.buildTree(resolvedRoot, 0, maxDepth);
    }
    async readFile(filePath) {
        return this.safeFs.readFile(filePath, "utf8");
    }
    async searchCode(query, options) {
        return this.searcher.searchCode(query, options);
    }
    getRecentChanges(limit) {
        return this.changeStore.getRecentEvents(limit);
    }
    async getLatestGitDiff(rootPath) {
        const root = rootPath ? this.safeFs.validatePath(rootPath) : this.config.allowedRoots[0];
        return this.gitTracker.getLatestGitDiff(root);
    }
    async getPromptHistory() {
        return this.artifactScanner.getPromptHistory();
    }
    async buildTree(currentPath, depth, maxDepth) {
        const stat = await this.safeFs.stat(currentPath);
        const name = path_1.default.basename(currentPath) || currentPath;
        const node = {
            path: currentPath,
            name,
            type: stat.isDirectory() ? "directory" : "file",
        };
        if (!stat.isDirectory() || depth >= maxDepth) {
            return node;
        }
        const entries = await this.safeFs.readDir(currentPath);
        const children = [];
        for (const entry of entries) {
            const childPath = path_1.default.join(currentPath, entry);
            if (this.safeFs.isIgnoredPath((0, utils_1.normalizePath)(childPath))) {
                continue;
            }
            try {
                children.push(await this.buildTree(childPath, depth + 1, maxDepth));
            }
            catch {
                continue;
            }
        }
        node.children = children;
        return node;
    }
}
exports.CursorWorkspaceTools = CursorWorkspaceTools;
//# sourceMappingURL=workspaceTools.js.map