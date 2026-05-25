import fs from "fs";
import path from "path";
import { CursorWatcher } from "../watcher";
import { SafeFs } from "../safeFs";
import { ChangeStore, FileEvent } from "../changeStore";
import { makeTmpDir, removeTmpDir, sleep, testConfig, writeFile } from "./helpers";

describe("CursorWatcher with real chokidar", () => {
  let root: string;
  let watcher: CursorWatcher;

  beforeEach(async () => {
    root = await makeTmpDir("watcher-");
    const config = testConfig(root);
    watcher = new CursorWatcher(config, new SafeFs(config), new ChangeStore(config));
  });

  afterEach(async () => {
    await watcher.stop();
    await removeTmpDir(root);
  });

  test("detects file add", async () => {
    await watcher.start();
    await sleep(300);
    const eventPromise = waitForEvent(watcher, "add");
    await writeFile(path.join(root, "new.txt"), "hello");
    await expect(eventPromise).resolves.toMatchObject({ type: "add" });
  });

  test("detects file change", async () => {
    const file = path.join(root, "change.txt");
    await writeFile(file, "one");
    await watcher.start();
    await sleep(300);
    const eventPromise = waitForEvent(watcher, "change");
    await writeFile(file, "two");
    await expect(eventPromise).resolves.toMatchObject({ type: "change" });
  });

  test("detects file delete as unlink", async () => {
    const file = path.join(root, "delete.txt");
    await writeFile(file, "gone");
    await watcher.start();
    await sleep(300);
    const eventPromise = waitForEvent(watcher, "unlink");
    await fs.promises.unlink(file);
    await expect(eventPromise).resolves.toMatchObject({ type: "unlink" });
  });

  test("files inside node_modules emit zero events", async () => {
    const events = collectEvents(watcher);
    await watcher.start();
    await sleep(300);
    await writeFile(path.join(root, "node_modules", "pkg", "file.ts"), "ignored");
    await sleep(800);
    expect(events()).toHaveLength(0);
  });

  test("files inside .git emit zero events", async () => {
    const events = collectEvents(watcher);
    await watcher.start();
    await sleep(300);
    await writeFile(path.join(root, ".git", "objects", "file"), "ignored");
    await sleep(800);
    expect(events()).toHaveLength(0);
  });

  test("debounces rapid repeated writes to no more than 2 change events", async () => {
    const file = path.join(root, "rapid.txt");
    await writeFile(file, "start");
    const events = collectEvents(watcher);
    await watcher.start();
    await sleep(300);
    for (let i = 0; i < 5; i += 1) {
      await writeFile(file, `value ${i}`);
      await sleep(20);
    }
    await sleep(800);
    expect(events().filter((event) => event.type === "change")).toHaveLengthLessThanOrEqual(2);
  });

  test("start is idempotent and does not double-emit", async () => {
    const events = collectEvents(watcher);
    await watcher.start();
    await watcher.start();
    await sleep(300);
    await writeFile(path.join(root, "one.txt"), "one");
    await sleep(800);
    expect(events().filter((event) => event.type === "add")).toHaveLength(1);
  });

  test("stop releases the watcher", async () => {
    const events = collectEvents(watcher);
    await watcher.start();
    await watcher.stop();
    await writeFile(path.join(root, "after-stop.txt"), "no event");
    await sleep(800);
    expect(events()).toHaveLength(0);
  });

  test("start with a non-existent path resolves cleanly", async () => {
    const missing = path.join(root, "missing");
    const config = testConfig(missing, { allowedRoots: [missing] });
    const missingWatcher = new CursorWatcher(config, new SafeFs(config), new ChangeStore(config));
    await expect(missingWatcher.start()).resolves.toBeUndefined();
    await missingWatcher.stop();
  });

  test("watching workspace A does not emit when workspace B changes", async () => {
    const other = await makeTmpDir("watcher-other-");
    try {
      const events = collectEvents(watcher);
      await watcher.start();
      await sleep(300);
      await writeFile(path.join(other, "other.txt"), "outside");
      await sleep(800);
      expect(events()).toHaveLength(0);
    } finally {
      await removeTmpDir(other);
    }
  });
});

function waitForEvent(watcher: CursorWatcher, type: string, timeout = 5000): Promise<FileEvent> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      watcher.off("project-event", onEvent);
      reject(new Error(`Timed out waiting for ${type}`));
    }, timeout);
    const onEvent = (event: FileEvent) => {
      if (event.type === type) {
        clearTimeout(timer);
        watcher.off("project-event", onEvent);
        resolve(event);
      }
    };
    watcher.on("project-event", onEvent);
  });
}

function collectEvents(watcher: CursorWatcher): () => FileEvent[] {
  const events: FileEvent[] = [];
  watcher.on("project-event", (event) => events.push(event));
  return () => events;
}

expect.extend({
  toHaveLengthLessThanOrEqual(received: unknown[], expected: number) {
    const pass = received.length <= expected;
    return {
      pass,
      message: () => `expected array length ${received.length} to be <= ${expected}`,
    };
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveLengthLessThanOrEqual(expected: number): R;
    }
  }
}
