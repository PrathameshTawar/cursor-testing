import fs from "fs";
import { CursorReaderConfig } from "./config";
export declare class SafeFs {
    private config;
    private allowedRoots;
    constructor(config: CursorReaderConfig);
    validatePath(filePath: string): string;
    isPathInsideAllowedRoots(resolvedPath: string): boolean;
    isIgnoredPath(resolvedPath: string): boolean;
    exists(filePath: string): Promise<boolean>;
    stat(filePath: string): Promise<fs.Stats>;
    readFile(filePath: string, encoding?: BufferEncoding): Promise<string>;
    readJsonFile<T = unknown>(filePath: string): Promise<T>;
    readBinary(filePath: string): Promise<Buffer>;
    readDir(filePath: string): Promise<string[]>;
    findFiles(rootPath: string, extensions?: string[]): Promise<string[]>;
}
