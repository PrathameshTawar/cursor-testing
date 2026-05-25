import path from "path";
import { CursorReaderConfig, buildDefaultConfig, normalizeConfigPaths } from "./config";
import { SafeFs } from "./safeFs";
import { ChangeStore } from "./changeStore";
import { CursorWatcher } from "./watcher";
import { GitTracker, GitDiffEntry } from "./gitTracker";
import { CodeSearcher, CodeSearchResult } from "./search";
import { CursorArtifactScanner } from "./artifactScanner";
import { FileEvent } from "./changeStore";
import { PromptSummary, normalizePath } from "./utils";

export interface ProjectSummary {
  root: string;
  gitRoot: string | null;
  active: boolean;
}

export interface ProjectTreeNode {
  path: string;
  name: string;
  type: "file" | "directory";
  children?: ProjectTreeNode[];
}

export class CursorWorkspaceTools {
  private config: CursorReaderConfig;
  private safeFs: SafeFs;
  private changeStore: ChangeStore;
  private watcher: CursorWatcher;
  private gitTracker: GitTracker;
  private searcher: CodeSearcher;
  private artifactScanner: CursorArtifactScanner;

  constructor(config?: CursorReaderConfig) {
    this.config = normalizeConfigPaths(config || buildDefaultConfig());
    this.safeFs = new SafeFs(this.config);
    this.changeStore = new ChangeStore(this.config);
    this.gitTracker = new GitTracker(this.config);
    this.searcher = new CodeSearcher(this.config, this.safeFs);
    this.artifactScanner = new CursorArtifactScanner(this.config, this.safeFs);
    this.watcher = new CursorWatcher(this.config, this.safeFs, this.changeStore);
  }

  async initialize(): Promise<void> {
    await this.watcher.start();
  }

  async shutdown(): Promise<void> {
    await this.watcher.stop();
  }

  listProjects(): ProjectSummary[] {
    return this.config.allowedRoots.map((root) => ({
      root: path.resolve(root),
      gitRoot: this.gitTracker.findGitRoot(root),
      active: true,
    }));
  }

  async getProjectTree(rootPath: string, maxDepth = 4): Promise<ProjectTreeNode> {
    const resolvedRoot = this.safeFs.validatePath(rootPath);
    return this.buildTree(resolvedRoot, 0, maxDepth);
  }

  async readFile(filePath: string): Promise<string> {
    return this.safeFs.readFile(filePath, "utf8");
  }

  async searchCode(query: string, options?: { caseSensitive?: boolean; fileExtensions?: string[] }): Promise<CodeSearchResult[]> {
    return this.searcher.searchCode(query, options);
  }

  getRecentChanges(limit?: number): FileEvent[] {
    return this.changeStore.getRecentEvents(limit);
  }

  async getLatestGitDiff(rootPath?: string): Promise<GitDiffEntry[]> {
    const root = rootPath ? this.safeFs.validatePath(rootPath) : this.config.allowedRoots[0];
    return this.gitTracker.getLatestGitDiff(root);
  }

  async getPromptHistory(): Promise<PromptSummary[]> {
    return this.artifactScanner.getPromptHistory();
  }

  private async buildTree(currentPath: string, depth: number, maxDepth: number): Promise<ProjectTreeNode> {
    const stat = await this.safeFs.stat(currentPath);
    const name = path.basename(currentPath) || currentPath;
    const node: ProjectTreeNode = {
      path: currentPath,
      name,
      type: stat.isDirectory() ? "directory" : "file",
    };

    if (!stat.isDirectory() || depth >= maxDepth) {
      return node;
    }

    const entries = await this.safeFs.readDir(currentPath);
    const children: ProjectTreeNode[] = [];
    for (const entry of entries) {
      const childPath = path.join(currentPath, entry);
      if (this.safeFs.isIgnoredPath(normalizePath(childPath))) {
        continue;
      }
      try {
        children.push(await this.buildTree(childPath, depth + 1, maxDepth));
      } catch {
        continue;
      }
    }
    node.children = children;
    return node;
  }
}
