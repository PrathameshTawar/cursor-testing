"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDefaultConfig = buildDefaultConfig;
exports.normalizeConfigPaths = normalizeConfigPaths;
const path_1 = __importDefault(require("path"));
function buildDefaultConfig() {
    return {
        allowedRoots: [process.cwd()],
        ignorePatterns: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"],
        blockedFilePatterns: ["**/.env*", "**/*.pem", "**/*.key", "**/*.p12", "**/*.pfx", "**/*.crt", "**/*.secret", "**/*.password", "**/*id_rsa*", "**/*id_dsa*", "**/credentials/**"],
        maxRecentChanges: 200,
        storeDirectory: path_1.default.join(process.cwd(), ".cursor-reader-store"),
        promptScanMaxBytes: 256 * 1024,
        serverPort: 4500,
    };
}
function normalizeConfigPaths(config) {
    return {
        ...config,
        allowedRoots: config.allowedRoots.map((root) => path_1.default.resolve(root)),
        storeDirectory: path_1.default.resolve(config.storeDirectory),
    };
}
//# sourceMappingURL=config.js.map