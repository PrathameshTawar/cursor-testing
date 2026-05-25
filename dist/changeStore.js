"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeStore = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class ChangeStore {
    constructor(config) {
        this.config = config;
        this.events = [];
        this.storeFile = path_1.default.join(config.storeDirectory, "recent-changes.json");
        this.ensureStoreDirectory();
        this.loadStore().catch(() => undefined);
    }
    getRecentEvents(limit = this.config.maxRecentChanges) {
        return this.events.slice(-limit).reverse();
    }
    async pushEvent(event) {
        this.events.push(event);
        if (this.events.length > this.config.maxRecentChanges) {
            this.events = this.events.slice(-this.config.maxRecentChanges);
        }
        await this.saveStore();
    }
    async ensureStoreDirectory() {
        await fs_1.default.promises.mkdir(this.config.storeDirectory, { recursive: true });
    }
    async loadStore() {
        try {
            const raw = await fs_1.default.promises.readFile(this.storeFile, "utf8");
            const parsed = JSON.parse(raw);
            this.events = Array.isArray(parsed) ? parsed : [];
        }
        catch {
            this.events = [];
        }
    }
    async saveStore() {
        await fs_1.default.promises.writeFile(this.storeFile, JSON.stringify(this.events, null, 2), "utf8");
    }
}
exports.ChangeStore = ChangeStore;
//# sourceMappingURL=changeStore.js.map