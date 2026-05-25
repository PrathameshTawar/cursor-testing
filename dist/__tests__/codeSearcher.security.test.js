"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const search_1 = require("../search");
const safeFs_1 = require("../safeFs");
const helpers_1 = require("./helpers");
describe("CodeSearcher", () => {
    let root;
    let searcher;
    beforeEach(async () => {
        root = await (0, helpers_1.makeTmpDir)("code-search-");
        await (0, helpers_1.writeFile)(path_1.default.join(root, "one.ts"), "foo\nbar\nFoo\n");
        await (0, helpers_1.writeFile)(path_1.default.join(root, "two.ts"), "foobar\nbarfoo\nfoo\n");
        await (0, helpers_1.writeFile)(path_1.default.join(root, "three.md"), "literal (a)[b] $c \\\\path\n");
        await (0, helpers_1.writeFile)(path_1.default.join(root, "four.js"), "nothing here\n");
        await (0, helpers_1.writeFile)(path_1.default.join(root, "five.json"), "{\"key\":\"foo\"}\n");
        const config = (0, helpers_1.testConfig)(root);
        searcher = new search_1.CodeSearcher(config, new safeFs_1.SafeFs(config));
    });
    afterEach(async () => {
        await (0, helpers_1.removeTmpDir)(root);
    });
    test("literal search finds the right lines with 1-indexed line numbers", async () => {
        const results = await searcher.searchCode("bar", { fileExtensions: [".ts"] });
        expect(results.map((r) => ({ file: path_1.default.basename(r.path), line: r.line, preview: r.preview }))).toEqual(expect.arrayContaining([
            { file: "one.ts", line: 2, preview: "bar" },
            { file: "two.ts", line: 1, preview: "foobar" },
            { file: "two.ts", line: 2, preview: "barfoo" },
        ]));
    });
    test("caseSensitive: true filters case", async () => {
        const results = await searcher.searchCode("Foo", { caseSensitive: true, fileExtensions: [".ts"] });
        expect(results.map((r) => r.preview)).toEqual(["Foo"]);
    });
    test("wholeWord: true matches foo but not foobar or barfoo", async () => {
        const results = await searcher.searchCode("foo", { fileExtensions: [".ts"], wholeWord: true });
        expect(results.map((r) => r.preview)).toEqual(["foo", "Foo", "foo"]);
    });
    test("regex metacharacters in literal mode match literally and do not crash", async () => {
        await expect(searcher.searchCode("(a)[b] $c \\\\path", { fileExtensions: [".md"], useRegex: false })).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ line: 1, preview: "literal (a)[b] $c \\\\path" })]));
    });
    test("ReDoS canary: catastrophic regex completes in under 2 seconds", async () => {
        const redosRoot = await (0, helpers_1.makeTmpDir)("redos-");
        try {
            await (0, helpers_1.writeFile)(path_1.default.join(redosRoot, "redos.ts"), `${"a".repeat(50)}!\n`);
            const script = `
        const { CodeSearcher } = require(${JSON.stringify(path_1.default.join(process.cwd(), "dist", "search.js"))});
        const { SafeFs } = require(${JSON.stringify(path_1.default.join(process.cwd(), "dist", "safeFs.js"))});
        const config = {
          allowedRoots: [${JSON.stringify(redosRoot)}],
          ignorePatterns: ["**/node_modules/**", "**/.git/**"],
          blockedFilePatterns: ["**/.env*"],
          maxRecentChanges: 200,
          storeDirectory: ${JSON.stringify(path_1.default.join(redosRoot, ".store"))},
          promptScanMaxBytes: 262144,
          serverPort: 0
        };
        const started = Date.now();
        new CodeSearcher(config, new SafeFs(config)).searchCode("(a+)+$", { useRegex: true, fileExtensions: [".ts"] })
          .then(() => { console.log(Date.now() - started); })
          .catch((error) => { console.error(error && error.message); process.exit(2); });
      `;
            const elapsed = await runNodeWithTimeout(script, 2000);
            expect(elapsed).toBeLessThan(2000);
        }
        finally {
            await (0, helpers_1.removeTmpDir)(redosRoot);
        }
    });
    test("invalid regex throws a clear error", async () => {
        await expect(searcher.searchCode("[unclosed", { fileExtensions: [".ts"], useRegex: true })).rejects.toThrow(/regular expression|regex|unterminated|invalid/i);
    });
    test("node_modules and .git are skipped", async () => {
        await (0, helpers_1.writeFile)(path_1.default.join(root, "node_modules", "pkg", "leak.ts"), "foo\n");
        await (0, helpers_1.writeFile)(path_1.default.join(root, ".git", "objects", "leak.ts"), "foo\n");
        const results = await searcher.searchCode("leak", { fileExtensions: [".ts"] });
        expect(results).toEqual([]);
    });
    test("searches outside allowed roots return zero results", async () => {
        const outside = await (0, helpers_1.makeTmpDir)("outside-search-");
        try {
            await (0, helpers_1.writeFile)(path_1.default.join(outside, "secret.ts"), "foo\n");
            const config = (0, helpers_1.testConfig)(root);
            const isolated = new search_1.CodeSearcher(config, new safeFs_1.SafeFs(config));
            const results = await isolated.searchCode("secret", { fileExtensions: [".ts"] });
            expect(results).toEqual([]);
        }
        finally {
            await (0, helpers_1.removeTmpDir)(outside);
        }
    });
    test("searching across 100 files completes in under 5 seconds", async () => {
        for (let i = 0; i < 100; i += 1) {
            await (0, helpers_1.writeFile)(path_1.default.join(root, "many", `file-${i}.ts`), `const value${i} = "needle";\n`);
        }
        const started = Date.now();
        const results = await searcher.searchCode("needle", { fileExtensions: [".ts"] });
        expect(results.length).toBeGreaterThanOrEqual(100);
        expect(Date.now() - started).toBeLessThan(5000);
    });
});
function runNodeWithTimeout(script, timeoutMs) {
    return new Promise((resolve, reject) => {
        const child = (0, child_process_1.spawn)(process.execPath, ["-e", script], { stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => {
            child.kill("SIGKILL");
            reject(new Error(`search did not complete within ${timeoutMs}ms; regex execution is DoSable`));
        }, timeoutMs);
        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        child.on("exit", (code) => {
            clearTimeout(timer);
            if (code !== 0) {
                reject(new Error(stderr || `child exited with ${code}`));
                return;
            }
            resolve(Number(stdout.trim()));
        });
    });
}
//# sourceMappingURL=codeSearcher.security.test.js.map