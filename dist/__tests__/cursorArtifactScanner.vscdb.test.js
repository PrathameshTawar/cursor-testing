"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const artifactScanner_1 = require("../artifactScanner");
const safeFs_1 = require("../safeFs");
const helpers_1 = require("./helpers");
describe("CursorArtifactScanner state.vscdb extraction", () => {
    let root;
    beforeEach(async () => {
        root = await (0, helpers_1.makeTmpDir)("cursor-vscdb-");
    });
    afterEach(async () => {
        await (0, helpers_1.removeTmpDir)(root);
    });
    function scanner() {
        const config = (0, helpers_1.testConfig)(root, { promptScanMaxBytes: 100 * 1024 * 1024 });
        return new artifactScanner_1.CursorArtifactScanner(config, new safeFs_1.SafeFs(config));
    }
    function createStateDb(dbPath, value) {
        fs_1.default.mkdirSync(path_1.default.dirname(dbPath), { recursive: true });
        const db = new better_sqlite3_1.default(dbPath);
        db.exec("CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value BLOB)");
        db.prepare("INSERT INTO ItemTable (key, value) VALUES (?, ?)").run("workbench.panel.aichat.view.aichat.chatdata", value);
        db.prepare("INSERT INTO ItemTable (key, value) VALUES (?, ?)").run("pinnedViewlets", "prompt-looking unrelated pinnedViewlets row");
        db.close();
    }
    test("extracts known user prompt text from real ItemTable chatdata schema", async () => {
        const dbPath = path_1.default.join(root, "User", "workspaceStorage", "abc", "state.vscdb");
        createStateDb(dbPath, Buffer.from(JSON.stringify(chatDataFixture())));
        const prompts = await scanner().getPromptHistory();
        expect(prompts.map((p) => p.summary).join("\n")).toContain("Please refactor the auth flow safely");
    });
    test("uses bubble.timestamp, not the current time", async () => {
        const dbPath = path_1.default.join(root, "state.vscdb");
        createStateDb(dbPath, Buffer.from(JSON.stringify(chatDataFixture())));
        const prompts = await scanner().getPromptHistory();
        const prompt = prompts.find((p) => p.summary.includes("Please refactor the auth flow safely"));
        expect(prompt?.timestamp).toBe("1715000000000");
        expect(Math.abs(Date.now() - Number(prompt?.timestamp))).toBeGreaterThan(60000);
    });
    test("does not include unrelated pinnedViewlets row", async () => {
        const dbPath = path_1.default.join(root, "state.vscdb");
        createStateDb(dbPath, Buffer.from(JSON.stringify(chatDataFixture())));
        const prompts = await scanner().getPromptHistory();
        expect(prompts.map((p) => p.summary).join("\n")).not.toContain("pinnedViewlets");
    });
    test("missing state.vscdb returns empty prompt history cleanly", async () => {
        await expect(scanner().getPromptHistory()).resolves.toEqual([]);
    });
    test("malformed JSON chatdata does not throw", async () => {
        const dbPath = path_1.default.join(root, "state.vscdb");
        createStateDb(dbPath, Buffer.from("{bad json"));
        await expect(scanner().getPromptHistory()).resolves.toEqual(expect.any(Array));
    });
    test("SQLITE_BUSY is handled without an uncaught exception", async () => {
        const dbPath = path_1.default.join(root, "state.vscdb");
        createStateDb(dbPath, Buffer.from(JSON.stringify(chatDataFixture())));
        const lockDb = new better_sqlite3_1.default(dbPath);
        lockDb.exec("BEGIN EXCLUSIVE");
        try {
            await expect(scanner().getPromptHistory()).resolves.toEqual(expect.any(Array));
        }
        finally {
            lockDb.exec("ROLLBACK");
            lockDb.close();
        }
    });
    test("table-name SQL injection does not execute", async () => {
        const dbPath = path_1.default.join(root, "state.vscdb");
        fs_1.default.mkdirSync(path_1.default.dirname(dbPath), { recursive: true });
        const db = new better_sqlite3_1.default(dbPath);
        db.exec("CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value BLOB)");
        db.exec('CREATE TABLE "evil""; DROP TABLE ItemTable; --" (value TEXT)');
        db.close();
        await scanner().getPromptHistory();
        const check = new better_sqlite3_1.default(dbPath, { readonly: true });
        try {
            expect(check.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ItemTable'").get()).toBeTruthy();
        }
        finally {
            check.close();
        }
    });
    test("50MB database extraction completes in under 2 seconds", async () => {
        const dbPath = path_1.default.join(root, "state.vscdb");
        fs_1.default.mkdirSync(path_1.default.dirname(dbPath), { recursive: true });
        const db = new better_sqlite3_1.default(dbPath);
        db.exec("CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value BLOB)");
        const insert = db.prepare("INSERT INTO ItemTable (key, value) VALUES (?, ?)");
        insert.run("workbench.panel.aichat.view.aichat.chatdata", Buffer.from(JSON.stringify(chatDataFixture())));
        const padding = Buffer.alloc(1024 * 1024, "x");
        for (let i = 0; i < 50; i += 1) {
            insert.run(`padding-${i}`, padding);
        }
        db.close();
        const started = Date.now();
        await scanner().getPromptHistory();
        expect(Date.now() - started).toBeLessThan(2000);
    });
});
function chatDataFixture() {
    return {
        tabs: [
            {
                chatTitle: "Known chat",
                bubbles: [
                    { type: "user", text: "Please refactor the auth flow safely", timestamp: 1715000000000 },
                    { type: "assistant", text: "Sure, I can help.", timestamp: 1715000001000 },
                ],
            },
        ],
    };
}
//# sourceMappingURL=cursorArtifactScanner.vscdb.test.js.map