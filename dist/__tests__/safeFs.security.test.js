"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const safeFs_1 = require("../safeFs");
const helpers_1 = require("./helpers");
describe("SafeFs sandbox security", () => {
    let tmpRoot;
    let allowed;
    let outside;
    beforeEach(async () => {
        tmpRoot = await (0, helpers_1.makeTmpDir)("safe-fs-");
        allowed = path_1.default.join(tmpRoot, "allowed");
        outside = path_1.default.join(tmpRoot, "outside");
        await fs_1.default.promises.mkdir(allowed, { recursive: true });
        await fs_1.default.promises.mkdir(outside, { recursive: true });
    });
    afterEach(async () => {
        await (0, helpers_1.removeTmpDir)(tmpRoot);
    });
    function safeFs(roots = [allowed]) {
        return new safeFs_1.SafeFs((0, helpers_1.testConfig)(allowed, { allowedRoots: roots }));
    }
    test("reading a normal file inside the allowed root works", async () => {
        const file = path_1.default.join(allowed, "ok.txt");
        await (0, helpers_1.writeFile)(file, "inside");
        await expect(safeFs().readFile(file)).resolves.toBe("inside");
    });
    test("../ traversal that escapes the allowed root is rejected", async () => {
        const secret = path_1.default.join(outside, "secret.txt");
        await (0, helpers_1.writeFile)(secret, "secret");
        await expect(safeFs().readFile(path_1.default.join(allowed, "..", "outside", "secret.txt"))).rejects.toThrow(/not within/i);
    });
    test("absolute paths outside the allowed root are rejected", async () => {
        const secret = path_1.default.join(outside, "absolute-secret.txt");
        await (0, helpers_1.writeFile)(secret, "secret");
        await expect(safeFs().readFile(secret)).rejects.toThrow(/not within/i);
    });
    test("prefix spoofing sibling directory is not readable", async () => {
        const evilRoot = path_1.default.join(tmpRoot, "allowed-evil");
        const secret = path_1.default.join(evilRoot, "secret.txt");
        await (0, helpers_1.writeFile)(secret, "evil");
        await expect(safeFs().readFile(secret)).rejects.toThrow(/not within/i);
    });
    test("symlink escape to an outside file is rejected", async () => {
        const secret = path_1.default.join(outside, "secret.txt");
        const link = path_1.default.join(allowed, "link.txt");
        await (0, helpers_1.writeFile)(secret, "symlink-secret");
        await fs_1.default.promises.symlink(secret, link, "file");
        await expect(safeFs().readFile(link)).rejects.toThrow(/not within|symlink|unsafe/i);
    });
    test("symlinked directory inside allowed root pointing outside is not walkable", async () => {
        await (0, helpers_1.writeFile)(path_1.default.join(outside, "secret.txt"), "dir-secret");
        const link = path_1.default.join(allowed, "outside-link");
        await fs_1.default.promises.symlink(outside, link, process.platform === "win32" ? "junction" : "dir");
        await expect(safeFs().readFile(path_1.default.join(link, "secret.txt"))).rejects.toThrow(/not within|symlink|unsafe/i);
    });
    test("symlink chain whose final target is outside is rejected", async () => {
        const secret = path_1.default.join(outside, "secret.txt");
        const link2 = path_1.default.join(allowed, "link2.txt");
        const link1 = path_1.default.join(allowed, "link1.txt");
        await (0, helpers_1.writeFile)(secret, "chain-secret");
        await fs_1.default.promises.symlink(secret, link2, "file");
        await fs_1.default.promises.symlink(link2, link1, "file");
        await expect(safeFs().readFile(link1)).rejects.toThrow(/not within|symlink|unsafe/i);
    });
    test("chokepoint bypass with raw allowed root string is rejected", async () => {
        await (0, helpers_1.writeFile)(path_1.default.join(outside, "secret.txt"), "secret");
        const bypass = path_1.default.join(allowed, ".", "..", "outside", "secret.txt");
        await expect(safeFs().readFile(bypass)).rejects.toThrow(/not within/i);
    });
    test(".env files are blocked at root and nested", async () => {
        const rootEnv = path_1.default.join(allowed, ".env");
        const nestedEnv = path_1.default.join(allowed, "nested", ".env");
        await (0, helpers_1.writeFile)(rootEnv, "ROOT_SECRET=1");
        await (0, helpers_1.writeFile)(nestedEnv, "NESTED_SECRET=1");
        await expect(safeFs().readFile(rootEnv)).rejects.toThrow(/blocked/i);
        await expect(safeFs().readFile(nestedEnv)).rejects.toThrow(/blocked/i);
    });
    test(".environment-setup.md is not blocked by .env substring matching", async () => {
        const file = path_1.default.join(allowed, ".environment-setup.md");
        await (0, helpers_1.writeFile)(file, "setup notes");
        await expect(safeFs().readFile(file)).resolves.toBe("setup notes");
    });
    test("files larger than 5MB are rejected with a size error", async () => {
        const file = path_1.default.join(allowed, "large.txt");
        await (0, helpers_1.writeFile)(file, Buffer.alloc(5 * 1024 * 1024 + 1, "a"));
        await expect(safeFs().readFile(file)).rejects.toThrow(/size|large|5\s*MB/i);
    });
    test("null bytes in paths are rejected", async () => {
        await expect(safeFs().readFile(`${path_1.default.join(allowed, "ok.txt")}\0suffix`)).rejects.toThrow(/null|invalid/i);
    });
    test("findFiles does not escape via symlinks during recursion", async () => {
        await (0, helpers_1.writeFile)(path_1.default.join(outside, "secret.ts"), "export const secret = 1;");
        await fs_1.default.promises.symlink(outside, path_1.default.join(allowed, "linked-dir"), process.platform === "win32" ? "junction" : "dir");
        const results = await safeFs().findFiles(allowed, [".ts"]);
        expect(results).toEqual([]);
    });
    test("findFiles terminates on symlink loops within 10 seconds", async () => {
        const dir = path_1.default.join(allowed, "loop");
        await fs_1.default.promises.mkdir(dir);
        await fs_1.default.promises.symlink(dir, path_1.default.join(dir, "self"), process.platform === "win32" ? "junction" : "dir");
        const started = Date.now();
        await expect(safeFs().findFiles(allowed)).resolves.toEqual([]);
        expect(Date.now() - started).toBeLessThan(10000);
    });
    test("empty allowedRoots rejects everything", async () => {
        const file = path_1.default.join(allowed, "ok.txt");
        await (0, helpers_1.writeFile)(file, "inside");
        await expect(safeFs([]).readFile(file)).rejects.toThrow(/not within/i);
    });
});
//# sourceMappingURL=safeFs.security.test.js.map