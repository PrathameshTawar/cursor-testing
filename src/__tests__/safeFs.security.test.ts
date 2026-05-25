import fs from "fs";
import path from "path";
import { SafeFs } from "../safeFs";
import { testConfig, makeTmpDir, removeTmpDir, writeFile } from "./helpers";

describe("SafeFs sandbox security", () => {
  let tmpRoot: string;
  let allowed: string;
  let outside: string;

  beforeEach(async () => {
    tmpRoot = await makeTmpDir("safe-fs-");
    allowed = path.join(tmpRoot, "allowed");
    outside = path.join(tmpRoot, "outside");
    await fs.promises.mkdir(allowed, { recursive: true });
    await fs.promises.mkdir(outside, { recursive: true });
  });

  afterEach(async () => {
    await removeTmpDir(tmpRoot);
  });

  function safeFs(roots = [allowed]): SafeFs {
    return new SafeFs(testConfig(allowed, { allowedRoots: roots }));
  }

  test("reading a normal file inside the allowed root works", async () => {
    const file = path.join(allowed, "ok.txt");
    await writeFile(file, "inside");
    await expect(safeFs().readFile(file)).resolves.toBe("inside");
  });

  test("../ traversal that escapes the allowed root is rejected", async () => {
    const secret = path.join(outside, "secret.txt");
    await writeFile(secret, "secret");
    await expect(safeFs().readFile(path.join(allowed, "..", "outside", "secret.txt"))).rejects.toThrow(/not within/i);
  });

  test("absolute paths outside the allowed root are rejected", async () => {
    const secret = path.join(outside, "absolute-secret.txt");
    await writeFile(secret, "secret");
    await expect(safeFs().readFile(secret)).rejects.toThrow(/not within/i);
  });

  test("prefix spoofing sibling directory is not readable", async () => {
    const evilRoot = path.join(tmpRoot, "allowed-evil");
    const secret = path.join(evilRoot, "secret.txt");
    await writeFile(secret, "evil");
    await expect(safeFs().readFile(secret)).rejects.toThrow(/not within/i);
  });

  test("symlink escape to an outside file is rejected", async () => {
    const secret = path.join(outside, "secret.txt");
    const link = path.join(allowed, "link.txt");
    await writeFile(secret, "symlink-secret");
    await fs.promises.symlink(secret, link, "file");
    await expect(safeFs().readFile(link)).rejects.toThrow(/not within|symlink|unsafe/i);
  });

  test("symlinked directory inside allowed root pointing outside is not walkable", async () => {
    await writeFile(path.join(outside, "secret.txt"), "dir-secret");
    const link = path.join(allowed, "outside-link");
    await fs.promises.symlink(outside, link, process.platform === "win32" ? "junction" : "dir");
    await expect(safeFs().readFile(path.join(link, "secret.txt"))).rejects.toThrow(/not within|symlink|unsafe/i);
  });

  test("symlink chain whose final target is outside is rejected", async () => {
    const secret = path.join(outside, "secret.txt");
    const link2 = path.join(allowed, "link2.txt");
    const link1 = path.join(allowed, "link1.txt");
    await writeFile(secret, "chain-secret");
    await fs.promises.symlink(secret, link2, "file");
    await fs.promises.symlink(link2, link1, "file");
    await expect(safeFs().readFile(link1)).rejects.toThrow(/not within|symlink|unsafe/i);
  });

  test("chokepoint bypass with raw allowed root string is rejected", async () => {
    await writeFile(path.join(outside, "secret.txt"), "secret");
    const bypass = path.join(allowed, ".", "..", "outside", "secret.txt");
    await expect(safeFs().readFile(bypass)).rejects.toThrow(/not within/i);
  });

  test(".env files are blocked at root and nested", async () => {
    const rootEnv = path.join(allowed, ".env");
    const nestedEnv = path.join(allowed, "nested", ".env");
    await writeFile(rootEnv, "ROOT_SECRET=1");
    await writeFile(nestedEnv, "NESTED_SECRET=1");
    await expect(safeFs().readFile(rootEnv)).rejects.toThrow(/blocked/i);
    await expect(safeFs().readFile(nestedEnv)).rejects.toThrow(/blocked/i);
  });

  test(".environment-setup.md is not blocked by .env substring matching", async () => {
    const file = path.join(allowed, ".environment-setup.md");
    await writeFile(file, "setup notes");
    await expect(safeFs().readFile(file)).resolves.toBe("setup notes");
  });

  test("files larger than 5MB are rejected with a size error", async () => {
    const file = path.join(allowed, "large.txt");
    await writeFile(file, Buffer.alloc(5 * 1024 * 1024 + 1, "a"));
    await expect(safeFs().readFile(file)).rejects.toThrow(/size|large|5\s*MB/i);
  });

  test("null bytes in paths are rejected", async () => {
    await expect(safeFs().readFile(`${path.join(allowed, "ok.txt")}\0suffix`)).rejects.toThrow(/null|invalid/i);
  });

  test("findFiles does not escape via symlinks during recursion", async () => {
    await writeFile(path.join(outside, "secret.ts"), "export const secret = 1;");
    await fs.promises.symlink(outside, path.join(allowed, "linked-dir"), process.platform === "win32" ? "junction" : "dir");
    const results = await safeFs().findFiles(allowed, [".ts"]);
    expect(results).toEqual([]);
  });

  test("findFiles terminates on symlink loops within 10 seconds", async () => {
    const dir = path.join(allowed, "loop");
    await fs.promises.mkdir(dir);
    await fs.promises.symlink(dir, path.join(dir, "self"), process.platform === "win32" ? "junction" : "dir");
    const started = Date.now();
    await expect(safeFs().findFiles(allowed)).resolves.toEqual([]);
    expect(Date.now() - started).toBeLessThan(10000);
  });

  test("empty allowedRoots rejects everything", async () => {
    const file = path.join(allowed, "ok.txt");
    await writeFile(file, "inside");
    await expect(safeFs([]).readFile(file)).rejects.toThrow(/not within/i);
  });
});
