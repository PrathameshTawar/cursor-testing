"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CursorArtifactScanner = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const utils_1 = require("./utils");
class CursorArtifactScanner {
    constructor(config, safeFs) {
        this.config = config;
        this.safeFs = safeFs;
    }
    async scanArtifacts() {
        const summaries = [];
        for (const root of this.config.allowedRoots) {
            summaries.push(...(await this.scanCursorDirectory(root)));
            summaries.push(...(await this.scanWorkspaceStorage(root)));
            summaries.push(...(await this.scanStateDatabases(root)));
        }
        return summaries;
    }
    async getPromptHistory() {
        return this.scanArtifacts();
    }
    async scanCursorDirectory(root) {
        const result = [];
        const cursorDir = path_1.default.join(root, ".cursor");
        if (!(await this.safeFs.exists(cursorDir))) {
            return result;
        }
        const files = await this.safeFs.findFiles(cursorDir, [".json", ".txt", ".md"]);
        for (const filePath of files) {
            try {
                const content = await this.safeFs.readFile(filePath, "utf8");
                if (content.length === 0) {
                    continue;
                }
                result.push({
                    source: filePath,
                    summary: (0, utils_1.scrubPromptText)(content),
                    timestamp: new Date().toISOString(),
                    relatedFiles: [filePath],
                });
            }
            catch {
                continue;
            }
        }
        return result;
    }
    async scanWorkspaceStorage(root) {
        const result = [];
        const storageDir = path_1.default.join(root, "workspaceStorage");
        if (!(await this.safeFs.exists(storageDir))) {
            return result;
        }
        const files = await this.safeFs.findFiles(storageDir, [".json", ".log", ".txt"]);
        for (const filePath of files) {
            try {
                const stats = await this.safeFs.stat(filePath);
                if (stats.size > this.config.promptScanMaxBytes) {
                    continue;
                }
                const parsed = await this.safeFs.readJsonFile(filePath).catch(() => null);
                if (parsed !== null) {
                    result.push(...(0, utils_1.extractPromptSummariesFromJson)(parsed, filePath));
                    continue;
                }
                const content = await this.safeFs.readFile(filePath, "utf8");
                const summary = (0, utils_1.scrubPromptText)(content);
                if (summary.length > 0) {
                    result.push({
                        source: filePath,
                        summary: (0, utils_1.truncateText)(summary, 300),
                        timestamp: new Date().toISOString(),
                        relatedFiles: [filePath],
                    });
                }
            }
            catch {
                continue;
            }
        }
        return result;
    }
    async scanStateDatabases(root) {
        const result = [];
        const candidateFiles = await this.findStateDatabaseFiles(root);
        for (const filePath of candidateFiles) {
            try {
                const buffer = await this.safeFs.readBinary(filePath);
                const parsed = await this.tryParseSqlite(buffer, filePath);
                if (parsed.length > 0) {
                    result.push(...parsed);
                    continue;
                }
                result.push({
                    source: filePath,
                    summary: "Detected a state.vscdb artifact; prompt metadata may exist in the VS Code workspace database.",
                    timestamp: new Date().toISOString(),
                    relatedFiles: [filePath],
                });
            }
            catch {
                continue;
            }
        }
        return result;
    }
    async findStateDatabaseFiles(root) {
        const files = [];
        const walk = async (currentPath) => {
            const entries = await fs_1.default.promises.readdir(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                const childPath = path_1.default.join(currentPath, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist" || entry.name === "build") {
                        continue;
                    }
                    await walk(childPath);
                    continue;
                }
                if (entry.name === "state.vscdb" || entry.name.endsWith(".vscdb")) {
                    const normalized = path_1.default.resolve(childPath);
                    if (this.safeFs.isIgnoredPath(normalized) || !this.safeFs.isPathInsideAllowedRoots(normalized)) {
                        continue;
                    }
                    files.push(normalized);
                }
            }
        };
        await walk(root);
        return files;
    }
    async tryParseSqlite(buffer, filePath) {
        try {
            const initSqlJs = await Promise.resolve().then(() => __importStar(require("sql.js")));
            const SQL = await initSqlJs.default({ locateFile: () => "sql-wasm.wasm" });
            const db = new SQL.Database(new Uint8Array(buffer));
            const results = [];
            const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
            for (const table of tables) {
                for (const row of table.values) {
                    const tableName = row[0];
                    if (typeof tableName !== "string") {
                        continue;
                    }
                    const rows = db.exec(`SELECT * FROM \"${tableName.replace(/\"/g, "\"\"")}\" LIMIT 20`);
                    for (const rowSet of rows) {
                        for (const value of rowSet.values.flat()) {
                            const text = typeof value === "string" ? value : "";
                            if (text.length > 20 && /prompt|query|message|assistant|user|chat/i.test(text)) {
                                results.push({
                                    source: filePath,
                                    summary: (0, utils_1.scrubPromptText)(text),
                                    timestamp: new Date().toISOString(),
                                    relatedFiles: [filePath],
                                });
                            }
                        }
                    }
                }
            }
            return results;
        }
        catch {
            return [];
        }
    }
}
exports.CursorArtifactScanner = CursorArtifactScanner;
//# sourceMappingURL=artifactScanner.js.map