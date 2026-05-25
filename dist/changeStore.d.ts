import { CursorReaderConfig } from "./config";
export type FileEventType = "add" | "change" | "delete";
export interface FileEvent {
    type: FileEventType;
    path: string;
    root: string;
    timestamp: string;
    size?: number;
}
export declare class ChangeStore {
    private config;
    private events;
    private storeFile;
    constructor(config: CursorReaderConfig);
    getRecentEvents(limit?: number): FileEvent[];
    pushEvent(event: FileEvent): Promise<void>;
    private ensureStoreDirectory;
    private loadStore;
    private saveStore;
}
