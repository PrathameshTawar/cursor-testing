import assert from "assert";
import path from "path";
import { buildDefaultConfig, normalizeConfigPaths, CursorReaderConfig } from "./config";
import { normalizePath } from "./utils";
import { CursorWorkspaceTools } from "./workspaceTools";
import { CursorReaderMCPServer } from "./mcpServer";

async function runTests(): Promise<void> {
  const root = process.cwd();
  const config: CursorReaderConfig = normalizeConfigPaths({
    ...buildDefaultConfig(),
    allowedRoots: [root],
    storeDirectory: path.join(root, ".cursor-reader-store-test"),
  });

  const tools = new CursorWorkspaceTools(config);
  await tools.initialize();

  try {
    const projects = tools.listProjects();
    assert(projects.length > 0, "Expected at least one project root");
    console.log("✓ listProjects returned project roots");

    const tree = await tools.getProjectTree(root, 2);
    assert(normalizePath(tree.path) === normalizePath(root), "Expected project tree root to match allowed root");
    console.log("✓ getProjectTree returned the root node");

    const readmePath = path.join(root, "README.md");
    const readmeText = await tools.readFile(readmePath);
    assert(readmeText.includes("cursor-reader"), "Expected README content to include module name");
    console.log("✓ readFile returned README content");

    const searchResults = await tools.searchCode("cursor-reader", { caseSensitive: false, fileExtensions: [".md", ".ts"] });
    assert(Array.isArray(searchResults) && searchResults.length > 0, "Expected searchCode to find at least one match");
    console.log(`✓ searchCode found ${searchResults.length} matches`);

    const changes = tools.getRecentChanges();
    assert(Array.isArray(changes), "Expected getRecentChanges to return an array");
    console.log("✓ getRecentChanges returned an array");

    const promptHistory = await tools.getPromptHistory();
    assert(Array.isArray(promptHistory), "Expected getPromptHistory to return an array");
    console.log("✓ getPromptHistory returned an array");

    const server = new CursorReaderMCPServer(config);
    const listDispatch = await server.dispatch("list_projects", {});
    assert(Array.isArray(listDispatch), "Expected dispatch list_projects to return an array");
    console.log("✓ MCP dispatch list_projects works");

    const readDispatch = await server.dispatch("read_file", { path: readmePath });
    assert(typeof readDispatch === "string" && readDispatch.includes("cursor-reader"), "Expected dispatch read_file to return README content");
    console.log("✓ MCP dispatch read_file works");

    console.log("All cursor-reader tests passed successfully.");
  } finally {
    await tools.shutdown();
  }
}

runTests().catch((error) => {
  console.error("cursor-reader test failure:", error);
  process.exit(1);
});
