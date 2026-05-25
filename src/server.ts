import path from "path";
import { buildDefaultConfig, CursorReaderConfig } from "./config";
import { CursorReaderMCPServer } from "./mcpServer";

function buildConfigFromEnv(): CursorReaderConfig {
  const config = buildDefaultConfig();
  if (process.env.CURSOR_READER_ROOTS) {
    config.allowedRoots = process.env.CURSOR_READER_ROOTS.split(path.delimiter).filter(Boolean).map((value) => path.resolve(value));
  }
  if (process.env.CURSOR_READER_PORT) {
    const parsed = Number(process.env.CURSOR_READER_PORT);
    if (!Number.isNaN(parsed) && parsed > 0) {
      config.serverPort = parsed;
    }
  }
  return config;
}

async function main(): Promise<void> {
  const config = buildConfigFromEnv();
  const server = new CursorReaderMCPServer(config);
  await server.start(config.serverPort);
  console.log(`CursorReader MCP server started on http://localhost:${config.serverPort}`);
  console.log("Allowed roots:", JSON.stringify(config.allowedRoots, null, 2));
}

main().catch((error) => {
  console.error("Failed to start CursorReader MCP server:", error);
  process.exit(1);
});
