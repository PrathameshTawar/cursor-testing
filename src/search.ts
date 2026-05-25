import path from "path";
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

export class CodeSearcher {
  constructor(private config: CursorReaderConfig, private safeFs: SafeFs) {}

  async searchCode(query: string, options: SearchOptions = {}): Promise<CodeSearchResult[]> {
    const pattern = options.caseSensitive ? query : query; // No transformation here for regex-based search
    const flags = options.caseSensitive ? "g" : "gi";
    const regex = new RegExp(pattern, flags);
    const extensions = options.fileExtensions ?? [".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".mdx", ".py", ".java", ".go", ".rs", ".sh"];
    const results: CodeSearchResult[] = [];

    for (const root of this.config.allowedRoots) {
      const files = await this.safeFs.findFiles(root, extensions);
      for (const filePath of files) {
        try {
          const contents = await this.safeFs.readFile(filePath, "utf8");
          const lines = contents.split(/\r?\n/);
          for (let index = 0; index < lines.length; index += 1) {
            const line = lines[index];
            const matches = line.match(regex);
            if (matches) {
              results.push({
                path: filePath,
                line: index + 1,
                preview: line.trim(),
                match: matches[0],
              });
            }
          }
        } catch {
          continue;
        }
      }
    }

    return results;
  }
}
