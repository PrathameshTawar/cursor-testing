"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeSearcher = void 0;
class CodeSearcher {
    constructor(config, safeFs) {
        this.config = config;
        this.safeFs = safeFs;
    }
    async searchCode(query, options = {}) {
        const pattern = options.caseSensitive ? query : query; // No transformation here for regex-based search
        const flags = options.caseSensitive ? "g" : "gi";
        const regex = new RegExp(pattern, flags);
        const extensions = options.fileExtensions ?? [".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".mdx", ".py", ".java", ".go", ".rs", ".sh"];
        const results = [];
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
                }
                catch {
                    continue;
                }
            }
        }
        return results;
    }
}
exports.CodeSearcher = CodeSearcher;
//# sourceMappingURL=search.js.map