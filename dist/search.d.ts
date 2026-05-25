import { SafeFs } from "./safeFs";
import { CursorReaderConfig } from "./config";
export interface CodeSearchResult {
    path: string;
    line: number;
    preview: string;
    match: string;
}
export interface SearchOptions {
    caseSensitive?: boolean;
    fileExtensions?: string[];
}
export declare class CodeSearcher {
    private config;
    private safeFs;
    constructor(config: CursorReaderConfig, safeFs: SafeFs);
    searchCode(query: string, options?: SearchOptions): Promise<CodeSearchResult[]>;
}
