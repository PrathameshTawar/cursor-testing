import { CursorReaderConfig } from "../config";
export declare function makeTmpDir(prefix: string): Promise<string>;
export declare function removeTmpDir(dir: string): Promise<void>;
export declare function testConfig(root: string, overrides?: Partial<CursorReaderConfig>): CursorReaderConfig;
export declare function writeFile(filePath: string, contents: string | Buffer): Promise<void>;
export declare function sleep(ms: number): Promise<void>;
