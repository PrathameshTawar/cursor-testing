import fs from "fs";
import path from "path";
import { ChangeStore, FileEvent } from "../changeStore";
import { makeTmpDir, removeTmpDir, testConfig, writeFile } from "./helpers";

describe("ChangeStore", () => {
  let root: string;

  beforeEach(async () => {
    root = await makeTmpDir("change-store-");
  });

  afterEach(async () => {
    await removeTmpDir(root);
  });

  test("addChange + getRecent returns entries", async () => {
    const store: any = new ChangeStore(testConfig(root));
    await addChange(store, event("add", "a.txt"));
    expect(getRecent(store)).toHaveLength(1);
  });

  test("getRecent returns newest first", async () => {
    const store: any = new ChangeStore(testConfig(root));
    await addChange(store, event("add", "old.txt", "2024-01-01T00:00:00.000Z"));
    await addChange(store, event("change", "new.txt", "2024-01-02T00:00:00.000Z"));
    expect(getRecent(store).map((entry: FileEvent) => path.basename(entry.path))).toEqual(["new.txt", "old.txt"]);
  });

  test("maxSize of 5 keeps exactly the 5 most recent entries", async () => {
    const store: any = new ChangeStore(testConfig(root, { maxRecentChanges: 5 }));
    for (let i = 0; i < 10; i += 1) {
      await addChange(store, event("add", `${i}.txt`));
    }
    expect(getRecent(store).map((entry: FileEvent) => path.basename(entry.path))).toEqual(["9.txt", "8.txt", "7.txt", "6.txt", "5.txt"]);
  });

  test("maxSize of 0 does not crash", async () => {
    const store: any = new ChangeStore(testConfig(root, { maxRecentChanges: 0 }));
    await expect(addChange(store, event("add", "a.txt"))).resolves.toBeUndefined();
  });

  test("negative maxSize throws in the constructor", () => {
    expect(() => new ChangeStore(testConfig(root, { maxRecentChanges: -1 }))).toThrow(/max/i);
  });

  test("getByType filters correctly", async () => {
    const store: any = new ChangeStore(testConfig(root));
    await addChange(store, event("add", "a.txt"));
    await addChange(store, event("change", "b.txt"));
    expect(store.getByType("change").map((entry: FileEvent) => entry.type)).toEqual(["change"]);
  });

  test("getByType for an absent type returns []", () => {
    const store: any = new ChangeStore(testConfig(root));
    expect(store.getByType("delete")).toEqual([]);
  });

  test("100 concurrent addChange calls all land", async () => {
    const store: any = new ChangeStore(testConfig(root, { maxRecentChanges: 200 }));
    await Promise.all(Array.from({ length: 100 }, (_, i) => addChange(store, event("add", `${i}.txt`))));
    expect(getRecent(store, 200)).toHaveLength(100);
  });
});

describe("LocalMemoryStore", () => {
  let root: string;

  beforeEach(async () => {
    root = await makeTmpDir("local-memory-");
  });

  afterEach(async () => {
    await removeTmpDir(root);
  });

  test("is implemented in the VS Code extension module", () => {
    expect(() => require("../localMemoryStore")).not.toThrow();
  });

  test("malformed JSON on disk returns [] without throwing", async () => {
    const { LocalMemoryStore } = require("../localMemoryStore");
    const file = path.join(root, "memory.json");
    await writeFile(file, "{bad json");
    const store = new LocalMemoryStore(file);
    await expect(store.loadEntries()).resolves.toEqual([]);
  });

  test("two instances concurrently adding 50 entries each persist exactly 100 entries", async () => {
    const { LocalMemoryStore } = require("../localMemoryStore");
    const file = path.join(root, "memory.json");
    const first = new LocalMemoryStore(file);
    const second = new LocalMemoryStore(file);
    await Promise.all([
      ...Array.from({ length: 50 }, (_, i) => first.addEntry({ id: `a-${i}` })),
      ...Array.from({ length: 50 }, (_, i) => second.addEntry({ id: `b-${i}` })),
    ]);
    const fresh = new LocalMemoryStore(file);
    await expect(fresh.loadEntries()).resolves.toHaveLength(100);
  });
});

function event(type: FileEvent["type"], name: string, timestamp = new Date().toISOString()): FileEvent {
  return { type, path: path.join("root", name), root: "root", timestamp };
}

function addChange(store: any, entry: FileEvent): Promise<void> {
  if (typeof store.addChange === "function") {
    return store.addChange(entry);
  }
  return store.pushEvent(entry);
}

function getRecent(store: any, limit?: number): FileEvent[] {
  if (typeof store.getRecent === "function") {
    return store.getRecent(limit);
  }
  return store.getRecentEvents(limit);
}
