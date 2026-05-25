import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { GitTracker } from "../gitTracker";
import { makeTmpDir, removeTmpDir, testConfig, writeFile } from "./helpers";

describe("GitTracker with real git", () => {
  let root: string;
  let tracker: any;

  beforeEach(async () => {
    root = await makeTmpDir("git-tracker-");
    tracker = new GitTracker(testConfig(root));
  });

  afterEach(async () => {
    await removeTmpDir(root);
  });

  test("isGitRepo returns true for an initialized repo", () => {
    git(root, "init");
    expect(tracker.isGitRepo(root)).toBe(true);
  });

  test("non-git getCurrentDiff never throws", async () => {
    await expect(tracker.getCurrentDiff(root)).resolves.toSatisfySafeEmpty();
  });

  test("modified tracked file diff contains filename and new content", async () => {
    await initRepoWithCommit(root);
    await writeFile(path.join(root, "file.txt"), "hello\nnew content\n");
    const diff = await tracker.getCurrentDiff(root);
    expect(JSON.stringify(diff)).toContain("file.txt");
    expect(JSON.stringify(diff)).toContain("new content");
  });

  test("clean working tree returns an empty diff, not an error", async () => {
    await initRepoWithCommit(root);
    await expect(tracker.getCurrentDiff(root)).resolves.toSatisfySafeEmpty();
  });

  test("untracked new file appears in getCurrentDiff result", async () => {
    await initRepoWithCommit(root);
    await writeFile(path.join(root, "new-file.txt"), "untracked\n");
    const diff = await tracker.getCurrentDiff(root);
    expect(JSON.stringify(diff)).toContain("new-file.txt");
  });

  test("getLatestCommit returns SHA, message, and author", async () => {
    await initRepoWithCommit(root);
    const commit = await tracker.getLatestCommit(root);
    expect(commit).toEqual(expect.objectContaining({ message: expect.stringContaining("initial"), author: expect.any(String) }));
    expect(commit.sha || commit.hash).toMatch(/^[0-9a-f]{40}$/);
  });

  test("getLatestCommit on a repo with zero commits does not throw", async () => {
    git(root, "init");
    await expect(tracker.getLatestCommit(root)).resolves.toSatisfySafeEmpty();
  });

  test("path shell metacharacters do not create /tmp/pwned", async () => {
    const pwned = path.join(os.tmpdir(), "pwned");
    await fs.promises.rm(pwned, { force: true });
    const evil = `${root}; touch ${pwned}`;
    await expect(Promise.resolve(tracker.getCurrentDiff(evil)).catch(() => null)).resolves.toBeDefined();
    expect(fs.existsSync(pwned)).toBe(false);
  });

  test("getCurrentDiff returns the same shape for dirty and clean repos", async () => {
    await initRepoWithCommit(root);
    const clean = await tracker.getCurrentDiff(root);
    await writeFile(path.join(root, "file.txt"), "changed\n");
    const dirty = await tracker.getCurrentDiff(root);
    expect(Array.isArray(dirty)).toBe(Array.isArray(clean));
    expect(typeof dirty).toBe(typeof clean);
  });
});

async function initRepoWithCommit(root: string): Promise<void> {
  git(root, "init");
  git(root, "config", "user.email", "test@example.com");
  git(root, "config", "user.name", "Test User");
  await writeFile(path.join(root, "file.txt"), "hello\n");
  git(root, "add", "file.txt");
  git(root, "commit", "-m", "initial commit");
}

function git(cwd: string, ...args: string[]): void {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
}

expect.extend({
  toSatisfySafeEmpty(received: unknown) {
    const pass =
      received === null ||
      (Array.isArray(received) && received.length === 0) ||
      (typeof received === "object" && received !== null && ((received as any).ok === false || Object.keys(received).length === 0)) ||
      received === "";
    return {
      pass,
      message: () => `expected ${JSON.stringify(received)} to be null, empty, or {ok:false}`,
    };
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toSatisfySafeEmpty(): R;
    }
  }
}
