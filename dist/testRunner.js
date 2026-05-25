"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
const utils_1 = require("./utils");
const workspaceTools_1 = require("./workspaceTools");
const mcpServer_1 = require("./mcpServer");
async function runTests() {
    const root = process.cwd();
    const config = (0, config_1.normalizeConfigPaths)({
        ...(0, config_1.buildDefaultConfig)(),
        allowedRoots: [root],
        storeDirectory: path_1.default.join(root, ".cursor-reader-store-test"),
    });
    const tools = new workspaceTools_1.CursorWorkspaceTools(config);
    await tools.initialize();
    try {
        const projects = tools.listProjects();
        (0, assert_1.default)(projects.length > 0, "Expected at least one project root");
        console.log("✓ listProjects returned project roots");
        const tree = await tools.getProjectTree(root, 2);
        (0, assert_1.default)((0, utils_1.normalizePath)(tree.path) === (0, utils_1.normalizePath)(root), "Expected project tree root to match allowed root");
        console.log("✓ getProjectTree returned the root node");
        const readmePath = path_1.default.join(root, "README.md");
        const readmeText = await tools.readFile(readmePath);
        (0, assert_1.default)(readmeText.includes("cursor-reader"), "Expected README content to include module name");
        console.log("✓ readFile returned README content");
        const searchResults = await tools.searchCode("cursor-reader", { caseSensitive: false, fileExtensions: [".md", ".ts"] });
        (0, assert_1.default)(Array.isArray(searchResults) && searchResults.length > 0, "Expected searchCode to find at least one match");
        console.log(`✓ searchCode found ${searchResults.length} matches`);
        const changes = tools.getRecentChanges();
        (0, assert_1.default)(Array.isArray(changes), "Expected getRecentChanges to return an array");
        console.log("✓ getRecentChanges returned an array");
        const promptHistory = await tools.getPromptHistory();
        (0, assert_1.default)(Array.isArray(promptHistory), "Expected getPromptHistory to return an array");
        console.log("✓ getPromptHistory returned an array");
        const server = new mcpServer_1.CursorReaderMCPServer(config);
        const listDispatch = await server.dispatch("list_projects", {});
        (0, assert_1.default)(Array.isArray(listDispatch), "Expected dispatch list_projects to return an array");
        console.log("✓ MCP dispatch list_projects works");
        const readDispatch = await server.dispatch("read_file", { path: readmePath });
        (0, assert_1.default)(typeof readDispatch === "string" && readDispatch.includes("cursor-reader"), "Expected dispatch read_file to return README content");
        console.log("✓ MCP dispatch read_file works");
        console.log("All cursor-reader tests passed successfully.");
    }
    finally {
        await tools.shutdown();
    }
}
runTests().catch((error) => {
    console.error("cursor-reader test failure:", error);
    process.exit(1);
});
//# sourceMappingURL=testRunner.js.map