import { EventEmitter } from "events";
import chokidar from "chokidar";
import path from "path";
import { CursorReaderConfig } from "./config";
import { SafeFs } from "./safeFs";
import { ChangeStore, FileEvent } from "./changeStore";

export type WatcherEvent = FileEvent;

export class CursorWatcher extends EventEmitter {
  private watcher?: chokidar.FSWatcher;

  constructor(
    private config: CursorReaderConfig,
    private safeFs: SafeFs,
    private changeStore: ChangeStore
  ) {
    super();
  }

  async start(): Promise<void> {
    const options: chokidar.WatchOptions = {
      ignored: this.config.ignorePatterns,
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 250,
        pollInterval: 100,
      },
    };

    this.watcher = chokidar.watch(this.config.allowedRoots, options);
    this.watcher.on("add", (filePath) => this.handleEvent("add", filePath));
    this.watcher.on("change", (filePath) => this.handleEvent("change", filePath));
    this.watcher.on("unlink", (filePath) => this.handleEvent("delete", filePath));
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }
  }

  private async handleEvent(type: FileEvent["type"], filePath: string): Promise<void> {
    try {
      const resolved = this.safeFs.validatePath(filePath);
      const stats = await this.safeFs.stat(resolved).catch(() => undefined);
      const root = this.config.allowedRoots.find((allowedRoot) => resolved.startsWith(path.resolve(allowedRoot))) || this.config.allowedRoots[0];
      const event: FileEvent = {
        type,
        path: resolved,
        root: path.resolve(root),
        timestamp: new Date().toISOString(),
        size: stats?.size,
      };
      await this.changeStore.pushEvent(event);
      this.emit("project-event", event);
    } catch {
      // ignore invalid or unsafe events
    }
  }
}
