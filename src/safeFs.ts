import fs from "fs";
import path from "path";
import micromatch from "micromatch";
import { CursorReaderConfig } from "./config";
import { isBlockedFilename, normalizePath } from "./utils";

export class SafeFs {
  private allowedRoots: string[];

  constructor(private config: CursorReaderConfig) {
    this.allowedRoots = config.allowedRoots.map((root) => normalizePath(root));
  }

  validatePath(filePath: string): string {
    const resolved = normalizePath(path.resolve(filePath));
    if (!this.isPathInsideAllowedRoots(resolved)) {
      throw new Error(`Path is not within allowed project roots: ${filePath}`);
    }
    if (this.isIgnoredPath(resolved)) {
      throw new Error(`Path is ignored by cursor-reader configuration: ${filePath}`);
    }
    if (isBlockedFilename(resolved, this.config.blockedFilePatterns)) {
      throw new Error(`Path is blocked for safety: ${filePath}`);
    }
    return resolved;
  }

  isPathInsideAllowedRoots(resolvedPath: string): boolean {
    return this.allowedRoots.some((root) => {
      const normalizedRoot = root.endsWith("/") ? root : `${root}/`;
      return resolvedPath === root || resolvedPath.startsWith(normalizedRoot);
    });
  }

  isIgnoredPath(resolvedPath: string): boolean {
    return micromatch.some(resolvedPath, this.config.ignorePatterns, { dot: true });
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const resolved = this.validatePath(filePath);
      await fs.promises.access(resolved, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async stat(filePath: string): Promise<fs.Stats> {
    const resolved = this.validatePath(filePath);
    return fs.promises.stat(resolved);
  }

  async readFile(filePath: string, encoding: BufferEncoding = "utf8"): Promise<string> {
    const resolved = this.validatePath(filePath);
    return fs.promises.readFile(resolved, encoding);
  }

  async readJsonFile<T = unknown>(filePath: string): Promise<T> {
    const content = await this.readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  }

  async readBinary(filePath: string): Promise<Buffer> {
    const resolved = this.validatePath(filePath);
    return fs.promises.readFile(resolved);
  }

  async readDir(filePath: string): Promise<string[]> {
    const resolved = this.validatePath(filePath);
    const entries = await fs.promises.readdir(resolved);
    return entries;
  }

  async findFiles(rootPath: string, extensions?: string[]): Promise<string[]> {
    const resolvedRoot = this.validatePath(rootPath);
    const results: string[] = [];

    const walk = async (currentPath: string): Promise<void> => {
      const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const childPath = path.join(currentPath, entry.name);
        const normalizedChild = normalizePath(childPath);
        if (this.isIgnoredPath(normalizedChild) || isBlockedFilename(normalizedChild, this.config.blockedFilePatterns)) {
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
