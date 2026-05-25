import fs from "fs";
import os from "os";
import path from "path";
import { CursorReaderConfig, normalizeConfigPaths } from "../config";

export async function makeTmpDir(prefix: string): Promise<string> {
  return fs.promises.mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function removeTmpDir(dir: string): Promise<void> {
  await fs.promises.rm(dir, { recursive: true, force: true });
}

export function testConfig(root: string, overrides: Partial<CursorReaderConfig> = {}): CursorReaderConfig {
  return normalizeConfigPaths({
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
    storeDirectory: path.join(root, ".store"),
    promptScanMaxBytes: 256 * 1024,
    serverPort: 0,
    ...overrides,
  });
}

export async function writeFile(filePath: string, contents: string | Buffer): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, contents);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
