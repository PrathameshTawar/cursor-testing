"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
const mcpServer_1 = require("./mcpServer");
function buildConfigFromEnv() {
    const config = (0, config_1.buildDefaultConfig)();
    if (process.env.CURSOR_READER_ROOTS) {
        config.allowedRoots = process.env.CURSOR_READER_ROOTS.split(path_1.default.delimiter).filter(Boolean).map((value) => path_1.default.resolve(value));
    }
    if (process.env.CURSOR_READER_PORT) {
        const parsed = Number(process.env.CURSOR_READER_PORT);
        if (!Number.isNaN(parsed) && parsed > 0) {
            config.serverPort = parsed;
        }
    }
    return config;
}
async function main() {
    const config = buildConfigFromEnv();
    const server = new mcpServer_1.CursorReaderMCPServer(config);
    await server.start(config.serverPort);
    console.log(`CursorReader MCP server started on http://localhost:${config.serverPort}`);
    console.log("Allowed roots:", JSON.stringify(config.allowedRoots, null, 2));
}
main().catch((error) => {
    console.error("Failed to start CursorReader MCP server:", error);
    process.exit(1);
});
//# sourceMappingURL=server.js.map