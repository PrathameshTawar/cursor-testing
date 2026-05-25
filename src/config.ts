import path from "path";

export interface CursorReaderConfig {
  allowedRoots: string[];
  ignorePatterns: string[];
  blockedFilePatterns: string[];
  maxRecentChanges: number;
  storeDirectory: string;
  promptScanMaxBytes: number;
  serverPort: number;
}

export function buildDefaultConfig(): CursorReaderConfig {
  return {
    allowedRoots: [process.cwd()],
    ignorePatterns: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"],
    blockedFilePatterns: ["**/.env*", "**/*.pem", "**/*.key", "**/*.p12", "**/*.pfx", "**/*.crt", "**/*.secret", "**/*.password", "**/*id_rsa*", "**/*id_dsa*", "**/credentials/**"],
    maxRecentChanges: 200,
    storeDirectory: path.join(process.cwd(), ".cursor-reader-store"),
    promptScanMaxBytes: 256 * 1024,
    serverPort: 4500,
  };
}

export function normalizeConfigPaths(config: CursorReaderConfig): CursorReaderConfig {
  return {
    ...config,
    allowedRoots: config.allowedRoots.map((root) => path.resolve(root)),
    storeDirectory: path.resolve(config.storeDirectory),
  };
}
