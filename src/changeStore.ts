import fs from "fs";
import path from "path";
import { CursorReaderConfig } from "./config";

export type FileEventType = "add" | "change" | "delete";

export interface FileEvent {
  type: FileEventType;
  path: string;
  root: string;
  timestamp: string;
  size?: number;
}

export class ChangeStore {
  private events: FileEvent[] = [];
  private storeFile: string;

  constructor(private config: CursorReaderConfig) {
    this.storeFile = path.join(config.storeDirectory, "recent-changes.json");
    this.ensureStoreDirectory();
    this.loadStore().catch(() => undefined);
  }

  getRecentEvents(limit = this.config.maxRecentChanges): FileEvent[] {
    return this.events.slice(-limit).reverse();
  }

  async pushEvent(event: FileEvent): Promise<void> {
    this.events.push(event);
    if (this.events.length > this.config.maxRecentChanges) {
      this.events = this.events.slice(-this.config.maxRecentChanges);
    }
    await this.saveStore();
  }

  private async ensureStoreDirectory(): Promise<void> {
    await fs.promises.mkdir(this.config.storeDirectory, { recursive: true });
  }

  private async loadStore(): Promise<void> {
    try {
      const raw = await fs.promises.readFile(this.storeFile, "utf8");
      const parsed = JSON.parse(raw) as FileEvent[];
      this.events = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.events = [];
    }
  }

  private async saveStore(): Promise<void> {
    await fs.promises.writeFile(this.storeFile, JSON.stringify(this.events, null, 2), "utf8");
  }
}
