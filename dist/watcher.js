"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CursorWatcher = void 0;
const events_1 = require("events");
const chokidar_1 = __importDefault(require("chokidar"));
const path_1 = __importDefault(require("path"));
class CursorWatcher extends events_1.EventEmitter {
    constructor(config, safeFs, changeStore) {
        super();
        this.config = config;
        this.safeFs = safeFs;
        this.changeStore = changeStore;
    }
    async start() {
        const options = {
            ignored: this.config.ignorePatterns,
            ignoreInitial: true,
            persistent: true,
            awaitWriteFinish: {
                stabilityThreshold: 250,
                pollInterval: 100,
            },
        };
        this.watcher = chokidar_1.default.watch(this.config.allowedRoots, options);
        this.watcher.on("add", (filePath) => this.handleEvent("add", filePath));
        this.watcher.on("change", (filePath) => this.handleEvent("change", filePath));
        this.watcher.on("unlink", (filePath) => this.handleEvent("delete", filePath));
    }
    async stop() {
        if (this.watcher) {
            await this.watcher.close();
            this.watcher = undefined;
        }
    }
    async handleEvent(type, filePath) {
        try {
            const resolved = this.safeFs.validatePath(filePath);
            const stats = await this.safeFs.stat(resolved).catch(() => undefined);
            const root = this.config.allowedRoots.find((allowedRoot) => resolved.startsWith(path_1.default.resolve(allowedRoot))) || this.config.allowedRoots[0];
            const event = {
                type,
                path: resolved,
                root: path_1.default.resolve(root),
                timestamp: new Date().toISOString(),
                size: stats?.size,
            };
            await this.changeStore.pushEvent(event);
            this.emit("project-event", event);
        }
        catch {
            // ignore invalid or unsafe events
        }
    }
}
exports.CursorWatcher = CursorWatcher;
//# sourceMappingURL=watcher.js.map