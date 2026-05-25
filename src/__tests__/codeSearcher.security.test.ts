import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { CodeSearcher } from "../search";
import { SafeFs } from "../safeFs";
import { makeTmpDir, removeTmpDir, testConfig, writeFile } from "./helpers";

describe("CodeSearcher", () => {
  let root: string;
  let searcher: CodeSearcher;

  beforeEach(async () => {
    root = await makeTmpDir("code-search-");
    await writeFile(path.join(root, "one.ts"), "foo\nbar\nFoo\n");
    await writeFile(path.join(root, "two.ts"), "foobar\nbarfoo\nfoo\n");
    await writeFile(path.join(root, "three.md"), "literal (a)[b] $c \\\\path\n");
    await writeFile(path.join(root, "four.js"), "nothing here\n");
    await writeFile(path.join(root, "five.json"), "{\"key\":\"foo\"}\n");
    const config = testConfig(root);
    searcher = new CodeSearcher(config, new SafeFs(config));
  });

  afterEach(async () => {
    await removeTmpDir(root);
  });

  test("literal search finds the right lines with 1-indexed line numbers", async () => {
    const results = await searcher.searchCode("bar", { fileExtensions: [".ts"] });
    expect(results.map((r) => ({ file: path.basename(r.path), line: r.line, preview: r.preview }))).toEqual(
      expect.arrayContaining([
        { file: "one.ts", line: 2, preview: "bar" },
        { file: "two.ts", line: 1, preview: "foobar" },
        { file: "two.ts", line: 2, preview: "barfoo" },
      ])
    );
  });

  test("caseSensitive: true filters case", async () => {
    const results = await searcher.searchCode("Foo", { caseSensitive: true, fileExtensions: [".ts"] });
    expect(results.map((r) => r.preview)).toEqual(["Foo"]);
  });

  test("wholeWord: true matches foo but not foobar or barfoo", async () => {
    const results = await searcher.searchCode("foo", { fileExtensions: [".ts"], wholeWord: true } as any);
    expect(results.map((r) => r.preview)).toEqual(["foo", "Foo", "foo"]);
  });

  test("regex metacharacters in literal mode match literally and do not crash", async () => {
    await expect(searcher.searchCode("(a)[b] $c \\\\path", { fileExtensions: [".md"], useRegex: false } as any)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ line: 1, preview: "literal (a)[b] $c \\\\path" })])
    );
  });

  test("ReDoS canary: catastrophic regex completes in under 2 seconds", async () => {
    const redosRoot = await makeTmpDir("redos-");
    try {
      await writeFile(path.join(redosRoot, "redos.ts"), `${"a".repeat(50)}!\n`);
      const script = `
        const { CodeSearcher } = require(${JSON.stringify(path.join(process.cwd(), "dist", "search.js"))});
        const { SafeFs } = require(${JSON.stringify(path.join(process.cwd(), "dist", "safeFs.js"))});
        const config = {
          allowedRoots: [${JSON.stringify(redosRoot)}],
          ignorePatterns: ["**/node_modules/**", "**/.git/**"],
          blockedFilePatterns: ["**/.env*"],
          maxRecentChanges: 200,
          storeDirectory: ${JSON.stringify(path.join(redosRoot, ".store"))},
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
    } finally {
      await removeTmpDir(redosRoot);
    }
  });

  test("invalid regex throws a clear error", async () => {
    await expect(searcher.searchCode("[unclosed", { fileExtensions: [".ts"], useRegex: true } as any)).rejects.toThrow(/regular expression|regex|unterminated|invalid/i);
  });

  test("node_modules and .git are skipped", async () => {
    await writeFile(path.join(root, "node_modules", "pkg", "leak.ts"), "foo\n");
    await writeFile(path.join(root, ".git", "objects", "leak.ts"), "foo\n");
    const results = await searcher.searchCode("leak", { fileExtensions: [".ts"] });
    expect(results).toEqual([]);
  });

  test("searches outside allowed roots return zero results", async () => {
    const outside = await makeTmpDir("outside-search-");
    try {
      await writeFile(path.join(outside, "secret.ts"), "foo\n");
      const config = testConfig(root);
      const isolated = new CodeSearcher(config, new SafeFs(config));
      const results = await isolated.searchCode("secret", { fileExtensions: [".ts"] });
      expect(results).toEqual([]);
    } finally {
      await removeTmpDir(outside);
    }
  });

  test("searching across 100 files completes in under 5 seconds", async () => {
    for (let i = 0; i < 100; i += 1) {
      await writeFile(path.join(root, "many", `file-${i}.ts`), `const value${i} = "needle";\n`);
    }
    const started = Date.now();
    const results = await searcher.searchCode("needle", { fileExtensions: [".ts"] });
    expect(results.length).toBeGreaterThanOrEqual(100);
    expect(Date.now() - started).toBeLessThan(5000);
  });
});

function runNodeWithTimeout(script: string, timeoutMs: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", script], { stdio: ["ignore", "pipe", "pipe"] });
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
