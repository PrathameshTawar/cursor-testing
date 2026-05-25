import path from "path";
import fs from "fs";
import { CursorReaderConfig } from "./config";
import { SafeFs } from "./safeFs";
import { PromptSummary, scrubPromptText, extractPromptSummariesFromJson, truncateText } from "./utils";

export class CursorArtifactScanner {
  constructor(private config: CursorReaderConfig, private safeFs: SafeFs) {}

  async scanArtifacts(): Promise<PromptSummary[]> {
    const summaries: PromptSummary[] = [];
    for (const root of this.config.allowedRoots) {
      summaries.push(...(await this.scanCursorDirectory(root)));
      summaries.push(...(await this.scanWorkspaceStorage(root)));
      summaries.push(...(await this.scanStateDatabases(root)));
    }
    return summaries;
  }

  async getPromptHistory(): Promise<PromptSummary[]> {
    return this.scanArtifacts();
  }

  private async scanCursorDirectory(root: string): Promise<PromptSummary[]> {
    const result: PromptSummary[] = [];
    const cursorDir = path.join(root, ".cursor");
    if (!(await this.safeFs.exists(cursorDir))) {
      return result;
    }
    const files = await this.safeFs.findFiles(cursorDir, [".json", ".txt", ".md"]);
    for (const filePath of files) {
      try {
        const content = await this.safeFs.readFile(filePath, "utf8");
        if (content.length === 0) {
          continue;
        }
        result.push({
          source: filePath,
          summary: scrubPromptText(content),
          timestamp: new Date().toISOString(),
          relatedFiles: [filePath],
        });
      } catch {
        continue;
      }
    }
    return result;
  }

  private async scanWorkspaceStorage(root: string): Promise<PromptSummary[]> {
    const result: PromptSummary[] = [];
    const storageDir = path.join(root, "workspaceStorage");
    if (!(await this.safeFs.exists(storageDir))) {
      return result;
    }
    const files = await this.safeFs.findFiles(storageDir, [".json", ".log", ".txt"]);
    for (const filePath of files) {
      try {
        const stats = await this.safeFs.stat(filePath);
        if (stats.size > this.config.promptScanMaxBytes) {
          continue;
        }
        const parsed = await this.safeFs.readJsonFile<unknown>(filePath).catch(() => null);
        if (parsed !== null) {
          result.push(...extractPromptSummariesFromJson(parsed, filePath));
          continue;
        }
        const content = await this.safeFs.readFile(filePath, "utf8");
        const summary = scrubPromptText(content);
        if (summary.length > 0) {
          result.push({
            source: filePath,
            summary: truncateText(summary, 300),
            timestamp: new Date().toISOString(),
            relatedFiles: [filePath],
          });
        }
      } catch {
        continue;
      }
    }
    return result;
  }

  private async scanStateDatabases(root: string): Promise<PromptSummary[]> {
    const result: PromptSummary[] = [];
    const candidateFiles = await this.findStateDatabaseFiles(root);
    for (const filePath of candidateFiles) {
      try {
        const buffer = await this.safeFs.readBinary(filePath);
        const parsed = await this.tryParseSqlite(buffer, filePath);
        if (parsed.length > 0) {
          result.push(...parsed);
          continue;
        }
        result.push({
          source: filePath,
          summary: "Detected a state.vscdb artifact; prompt metadata may exist in the VS Code workspace database.",
          timestamp: new Date().toISOString(),
          relatedFiles: [filePath],
        });
      } catch {
        continue;
      }
    }
    return result;
  }

  private async findStateDatabaseFiles(root: string): Promise<string[]> {
    const files: string[] = [];
    const walk = async (currentPath: string): Promise<void> => {
      const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const childPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist" || entry.name === "build") {
            continue;
          }
          await walk(childPath);
          continue;
        }
        if (entry.name === "state.vscdb" || entry.name.endsWith(".vscdb")) {
          const normalized = path.resolve(childPath);
          if (this.safeFs.isIgnoredPath(normalized) || !this.safeFs.isPathInsideAllowedRoots(normalized)) {
            continue;
          }
          files.push(normalized);
        }
      }
    };
    await walk(root);
    return files;
  }

  private async tryParseSqlite(buffer: Buffer, filePath: string): Promise<PromptSummary[]> {
    try {
      const initSqlJs = await import("sql.js");
      const SQL = await initSqlJs.default({ locateFile: () => "sql-wasm.wasm" });
      const db = new SQL.Database(new Uint8Array(buffer));
      const results: PromptSummary[] = [];
      const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
      for (const table of tables) {
        for (const row of table.values) {
          const tableName = row[0];
          if (typeof tableName !== "string") {
            continue;
          }
          const rows = db.exec(`SELECT * FROM \"${tableName.replace(/\"/g, "\"\"")}\" LIMIT 20`);
          for (const rowSet of rows) {
            for (const value of rowSet.values.flat()) {
              const text = typeof value === "string" ? value : "";
              if (text.length > 20 && /prompt|query|message|assistant|user|chat/i.test(text)) {
                results.push({
                  source: filePath,
                  summary: scrubPromptText(text),
                  timestamp: new Date().toISOString(),
                  relatedFiles: [filePath],
                });
              }
            }
          }
        }
      }
      return results;
    } catch {
      return [];
    }
  }
}
