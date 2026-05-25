"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SafeFs = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const micromatch_1 = __importDefault(require("micromatch"));
const utils_1 = require("./utils");
class SafeFs {
    constructor(config) {
        this.config = config;
        this.allowedRoots = config.allowedRoots.map((root) => (0, utils_1.normalizePath)(root));
    }
    validatePath(filePath) {
        const resolved = (0, utils_1.normalizePath)(path_1.default.resolve(filePath));
        if (!this.isPathInsideAllowedRoots(resolved)) {
            throw new Error(`Path is not within allowed project roots: ${filePath}`);
        }
        if (this.isIgnoredPath(resolved)) {
            throw new Error(`Path is ignored by cursor-reader configuration: ${filePath}`);
        }
        if ((0, utils_1.isBlockedFilename)(resolved, this.config.blockedFilePatterns)) {
            throw new Error(`Path is blocked for safety: ${filePath}`);
        }
        return resolved;
    }
    isPathInsideAllowedRoots(resolvedPath) {
        return this.allowedRoots.some((root) => {
            const normalizedRoot = root.endsWith("/") ? root : `${root}/`;
            return resolvedPath === root || resolvedPath.startsWith(normalizedRoot);
        });
    }
    isIgnoredPath(resolvedPath) {
        return micromatch_1.default.some(resolvedPath, this.config.ignorePatterns, { dot: true });
    }
    async exists(filePath) {
        try {
            const resolved = this.validatePath(filePath);
            await fs_1.default.promises.access(resolved, fs_1.default.constants.F_OK);
            return true;
        }
        catch {
            return false;
        }
    }
    async stat(filePath) {
        const resolved = this.validatePath(filePath);
        return fs_1.default.promises.stat(resolved);
    }
    async readFile(filePath, encoding = "utf8") {
        const resolved = this.validatePath(filePath);
        return fs_1.default.promises.readFile(resolved, encoding);
    }
    async readJsonFile(filePath) {
        const content = await this.readFile(filePath, "utf8");
        return JSON.parse(content);
    }
    async readBinary(filePath) {
        const resolved = this.validatePath(filePath);
        return fs_1.default.promises.readFile(resolved);
    }
    async readDir(filePath) {
        const resolved = this.validatePath(filePath);
        const entries = await fs_1.default.promises.readdir(resolved);
        return entries;
    }
    async findFiles(rootPath, extensions) {
        const resolvedRoot = this.validatePath(rootPath);
        const results = [];
        const walk = async (currentPath) => {
            const entries = await fs_1.default.promises.readdir(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                const childPath = path_1.default.join(currentPath, entry.name);
                const normalizedChild = (0, utils_1.normalizePath)(childPath);
                if (this.isIgnoredPath(normalizedChild) || (0, utils_1.isBlockedFilename)(normalizedChild, this.config.blockedFilePatterns)) {
                    continue;
                }
                if (entry.isDirectory()) {
                    await walk(childPath);
                    continue;
                }
                if (!extensions || extensions.some((ext) => entry.name.endsWith(ext))) {
                    results.push(normalizedChild);
                }
            }
        };
        await walk(resolvedRoot);
        return results;
    }
}
exports.SafeFs = SafeFs;
//# sourceMappingURL=safeFs.js.map