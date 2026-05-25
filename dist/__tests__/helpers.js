"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeTmpDir = makeTmpDir;
exports.removeTmpDir = removeTmpDir;
exports.testConfig = testConfig;
exports.writeFile = writeFile;
exports.sleep = sleep;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
async function makeTmpDir(prefix) {
    return fs_1.default.promises.mkdtemp(path_1.default.join(os_1.default.tmpdir(), prefix));
}
async function removeTmpDir(dir) {
    await fs_1.default.promises.rm(dir, { recursive: true, force: true });
}
function testConfig(root, overrides = {}) {
    return (0, config_1.normalizeConfigPaths)({
        allowedRoots: [root],
        ignorePatterns: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"],
        blockedFilePatterns: [
            "**/.env*",
            "**/*.pem",
            "**/*.key",
            "**/*.p12",
            "**/*.pfx",
            "**/*.crt",
            "**/*.secret",
            "**/*.password",
            "**/*id_rsa*",
            "**/*id_dsa*",
            "**/credentials/**",
        ],
        maxRecentChanges: 200,
        storeDirectory: path_1.default.join(root, ".store"),
        promptScanMaxBytes: 256 * 1024,
        serverPort: 0,
        ...overrides,
    });
}
async function writeFile(filePath, contents) {
    await fs_1.default.promises.mkdir(path_1.default.dirname(filePath), { recursive: true });
    await fs_1.default.promises.writeFile(filePath, contents);
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=helpers.js.map