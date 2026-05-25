"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitTracker = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const isomorphic_git_1 = __importDefault(require("isomorphic-git"));
const utils_1 = require("./utils");
class GitTracker {
    constructor(config) {
        this.config = config;
    }
    findGitRoot(filePath) {
        let current = (0, utils_1.normalizePath)(path_1.default.resolve(filePath));
        while (true) {
            const gitDir = path_1.default.join(current, ".git");
            if (fs_1.default.existsSync(gitDir)) {
                return current;
            }
            const parent = path_1.default.dirname(current);
            if (parent === current) {
                return null;
            }
            current = parent;
        }
    }
    async listGitChangedFiles(rootPath) {
        const root = this.findGitRoot(rootPath);
        if (!root) {
            return [];
        }
        const statusMatrix = await isomorphic_git_1.default.statusMatrix({ fs: fs_1.default, dir: root });
        return statusMatrix
            .filter(([, head, workdir, stage]) => workdir !== head || stage !== head || workdir !== stage)
            .map(([filepath, , workdir, stage]) => ({
            path: (0, utils_1.normalizePath)(path_1.default.join(root, filepath)),
            status: this.describeStatus(workdir, stage),
        }));
    }
    async getLatestGitDiff(rootPath) {
        const root = this.findGitRoot(rootPath);
        if (!root) {
            return [];
        }
        const changedFiles = await this.listGitChangedFiles(root);
        return changedFiles.map((entry) => ({
            path: entry.path,
            diff: `Change summary: ${entry.status}`,
        }));
    }
    describeStatus(workdir, stage) {
        if (workdir === 2 && stage === 2) {
            return "added";
        }
        if (workdir === 0 && stage === 0) {
            return "deleted";
        }
        return "modified";
    }
}
exports.GitTracker = GitTracker;
//# sourceMappingURL=gitTracker.js.map