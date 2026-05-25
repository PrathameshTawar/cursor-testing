import { EventEmitter } from "events";
import { CursorReaderConfig } from "./config";
import { SafeFs } from "./safeFs";
import { ChangeStore, FileEvent } from "./changeStore";
export type WatcherEvent = FileEvent;
export declare class CursorWatcher extends EventEmitter {
    private config;
    private safeFs;
    private changeStore;
    private watcher?;
    constructor(config: CursorReaderConfig, safeFs: SafeFs, changeStore: ChangeStore);
    start(): Promise<void>;
    stop(): Promise<void>;
    private handleEvent;
}
