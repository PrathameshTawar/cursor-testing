"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const watcher_1 = require("../watcher");
const safeFs_1 = require("../safeFs");
const changeStore_1 = require("../changeStore");
const helpers_1 = require("./helpers");
describe("CursorWatcher with real chokidar", () => {
    let root;
    let watcher;
    beforeEach(async () => {
        root = await (0, helpers_1.makeTmpDir)("watcher-");
        const config = (0, helpers_1.testConfig)(root);
        watcher = new watcher_1.CursorWatcher(config, new safeFs_1.SafeFs(config), new changeStore_1.ChangeStore(config));
    });
    afterEach(async () => {
        await watcher.stop();
        await (0, helpers_1.removeTmpDir)(root);
    });
    test("detects file add", async () => {
        await watcher.start();
        await (0, helpers_1.sleep)(300);
        const eventPromise = waitForEvent(watcher, "add");
        await (0, helpers_1.writeFile)(path_1.default.join(root, "new.txt"), "hello");
        await expect(eventPromise).resolves.toMatchObject({ type: "add" });
    });
    test("detects file change", async () => {
        const file = path_1.default.join(root, "change.txt");
        await (0, helpers_1.writeFile)(file, "one");
        await watcher.start();
        await (0, helpers_1.sleep)(300);
        const eventPromise = waitForEvent(watcher, "change");
        await (0, helpers_1.writeFile)(file, "two");
        await expect(eventPromise).resolves.toMatchObject({ type: "change" });
    });
    test("detects file delete as unlink", async () => {
        const file = path_1.default.join(root, "delete.txt");
        await (0, helpers_1.writeFile)(file, "gone");
        await watcher.start();
        await (0, helpers_1.sleep)(300);
        const eventPromise = waitForEvent(watcher, "unlink");
        await fs_1.default.promises.unlink(file);
        await expect(eventPromise).resolves.toMatchObject({ type: "unlink" });
    });
    test("files inside node_modules emit zero events", async () => {
        const events = collectEvents(watcher);
        await watcher.start();
        await (0, helpers_1.sleep)(300);
        await (0, helpers_1.writeFile)(path_1.default.join(root, "node_modules", "pkg", "file.ts"), "ignored");
        await (0, helpers_1.sleep)(800);
        expect(events()).toHaveLength(0);
    });
    test("files inside .git emit zero events", async () => {
        const events = collectEvents(watcher);
        await watcher.start();
        await (0, helpers_1.sleep)(300);
        await (0, helpers_1.writeFile)(path_1.default.join(root, ".git", "objects", "file"), "ignored");
        await (0, helpers_1.sleep)(800);
        expect(events()).toHaveLength(0);
    });
    test("debounces rapid repeated writes to no more than 2 change events", async () => {
        const file = path_1.default.join(root, "rapid.txt");
        await (0, helpers_1.writeFile)(file, "start");
        const events = collectEvents(watcher);
        await watcher.start();
        await (0, helpers_1.sleep)(300);
        for (let i = 0; i < 5; i += 1) {
            await (0, helpers_1.writeFile)(file, `value ${i}`);
            await (0, helpers_1.sleep)(20);
        }
        await (0, helpers_1.sleep)(800);
        expect(events().filter((event) => event.type === "change")).toHaveLengthLessThanOrEqual(2);
    });
    test("start is idempotent and does not double-emit", async () => {
        const events = collectEvents(watcher);
        await watcher.start();
        await watcher.start();
        await (0, helpers_1.sleep)(300);
        await (0, helpers_1.writeFile)(path_1.default.join(root, "one.txt"), "one");
        await (0, helpers_1.sleep)(800);
        expect(events().filter((event) => event.type === "add")).toHaveLength(1);
    });
    test("stop releases the watcher", async () => {
        const events = collectEvents(watcher);
        await watcher.start();
        await watcher.stop();
        await (0, helpers_1.writeFile)(path_1.default.join(root, "after-stop.txt"), "no event");
        await (0, helpers_1.sleep)(800);
        expect(events()).toHaveLength(0);
    });
    test("start with a non-existent path resolves cleanly", async () => {
        const missing = path_1.default.join(root, "missing");
        const config = (0, helpers_1.testConfig)(missing, { allowedRoots: [missing] });
        const missingWatcher = new watcher_1.CursorWatcher(config, new safeFs_1.SafeFs(config), new changeStore_1.ChangeStore(config));
        await expect(missingWatcher.start()).resolves.toBeUndefined();
        await missingWatcher.stop();
    });
    test("watching workspace A does not emit when workspace B changes", async () => {
        const other = await (0, helpers_1.makeTmpDir)("watcher-other-");
        try {
            const events = collectEvents(watcher);
            await watcher.start();
            await (0, helpers_1.sleep)(300);
            await (0, helpers_1.writeFile)(path_1.default.join(other, "other.txt"), "outside");
            await (0, helpers_1.sleep)(800);
            expect(events()).toHaveLength(0);
        }
        finally {
            await (0, helpers_1.removeTmpDir)(other);
        }
    });
});
function waitForEvent(watcher, type, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            watcher.off("project-event", onEvent);
            reject(new Error(`Timed out waiting for ${type}`));
        }, timeout);
        const onEvent = (event) => {
            if (event.type === type) {
                clearTimeout(timer);
                watcher.off("project-event", onEvent);
                resolve(event);
            }
        };
        watcher.on("project-event", onEvent);
    });
}
function collectEvents(watcher) {
    const events = [];
    watcher.on("project-event", (event) => events.push(event));
    return () => events;
}
expect.extend({
    toHaveLengthLessThanOrEqual(received, expected) {
        const pass = received.length <= expected;
        return {
            pass,
            message: () => `expected array length ${received.length} to be <= ${expected}`,
        };
    },
});
//# sourceMappingURL=watcher.integration.test.js.map