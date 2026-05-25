import fs from "fs";
import path from "path";
import git from "isomorphic-git";
import { CursorReaderConfig } from "./config";
import { normalizePath } from "./utils";

export interface GitChangeSummary {
  path: string;
  status: string;
}

export interface GitDiffEntry {
  path: string;
  diff: string;
}

export class GitTracker {
  constructor(private config: CursorReaderConfig) {}

  findGitRoot(filePath: string): string | null {
    let current = normalizePath(path.resolve(filePath));
    while (true) {
      const gitDir = path.join(current, ".git");
      if (fs.existsSync(gitDir)) {
        return current;
      }
      const parent = path.dirname(current);
      if (parent === current) {
        return null;
      }
      current = parent;
    }
  }

  async listGitChangedFiles(rootPath: string): Promise<GitChangeSummary[]> {
    const root = this.findGitRoot(rootPath);
    if (!root) {
      return [];
    }
    const statusMatrix = await git.statusMatrix({ fs, dir: root });
    return statusMatrix
      .filter(([, head, workdir, stage]) => workdir !== head || stage !== head || workdir !== stage)
      .map(([filepath, , workdir, stage]) => ({
        path: normalizePath(path.join(root, filepath)),
        status: this.describeStatus(workdir, stage),
      }));
  }

  async getLatestGitDiff(rootPath: string): Promise<GitDiffEntry[]> {
    const root = this.findGitRoot(rootPath);
    if (!root) {
      return [];
    }
    const changedFiles = await this.listGitChangedFiles(root);
    return changedFiles.map((entry) => ({
      path: entry.path,
      diff: `Change summary: ${entry.status}`,
    }));
  }

  private describeStatus(workdir: number, stage: number): string {
    if (workdir === 2 && stage === 2) {
      return "added";
    }
    if (workdir === 0 && stage === 0) {
      return "deleted";
    }
    return "modified";
  }
}
