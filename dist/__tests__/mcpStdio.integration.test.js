"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const helpers_1 = require("./helpers");
describe("MCP stdio integration", () => {
    let root;
    let client;
    beforeEach(async () => {
        root = await (0, helpers_1.makeTmpDir)("mcp-stdio-");
        await (0, helpers_1.writeFile)(path_1.default.join(root, "code.ts"), "export const needle = 1;\n");
        client = new StdioClient(root);
        await client.start();
    });
    afterEach(async () => {
        await client.stop();
        await (0, helpers_1.removeTmpDir)(root);
    });
    test("after initialize, tools/list returns documented tools", async () => {
        await client.request("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "jest", version: "1.0.0" } });
        const response = await client.request("tools/list", {});
        const names = response.result.tools.map((tool) => tool.name);
        expect(names).toEqual(expect.arrayContaining(["list_projects", "search_code", "get_recent_changes"]));
    });
    test("every listed tool has non-empty description and object inputSchema", async () => {
        await client.request("initialize", {});
        const response = await client.request("tools/list", {});
        for (const tool of response.result.tools) {
            expect(tool.description).toEqual(expect.any(String));
            expect(tool.description.length).toBeGreaterThan(0);
            expect(tool.inputSchema).toMatchObject({ type: "object" });
        }
    });
    test("search_code returns MCP text content", async () => {
        await client.request("initialize", {});
        const response = await client.request("tools/call", { name: "search_code", arguments: { query: "needle" } });
        expect(response.result).toEqual({ content: [expect.objectContaining({ type: "text", text: expect.any(String) })] });
    });
    test("unknown tool returns isError true, not a crash", async () => {
        await client.request("initialize", {});
        const response = await client.request("tools/call", { name: "unknown_tool", arguments: {} });
        expect(response.result).toEqual(expect.objectContaining({ isError: true }));
    });
    test("malformed search_code arguments return isError true", async () => {
        await client.request("initialize", {});
        const response = await client.request("tools/call", { name: "search_code", arguments: { query: 123 } });
        expect(response.result).toEqual(expect.objectContaining({ isError: true }));
    });
    test("100 sequential requests complete in under 15 seconds", async () => {
        await client.request("initialize", {});
        const started = Date.now();
        for (let i = 0; i < 100; i += 1) {
            await client.request("tools/list", {});
        }
        expect(Date.now() - started).toBeLessThan(15000);
    });
    test("read_file /etc/passwd is an error and leaks no root entries", async () => {
        await client.request("initialize", {});
        const response = await client.request("tools/call", { name: "read_file", arguments: { path: "/etc/passwd" } });
        expect(response.result).toEqual(expect.objectContaining({ isError: true }));
        expect(JSON.stringify(response)).not.toContain("root:");
    });
    test("server never writes non-JSON-RPC data to stdout", async () => {
        await client.request("initialize", {}).catch(() => undefined);
        await client.request("tools/list", {}).catch(() => undefined);
        expect(client.parseFailures).toBe(0);
    });
});
class StdioClient {
    constructor(root) {
        this.root = root;
        this.nextId = 1;
        this.pending = new Map();
        this.parseFailures = 0;
    }
    async start() {
        this.child = (0, child_process_1.spawn)(process.execPath, [path_1.default.join(process.cwd(), "dist", "server.js")], {
            env: { ...process.env, CURSOR_READER_ROOTS: this.root, CURSOR_READER_PORT: "0" },
            stdio: "pipe",
        });
        this.child.stdout.on("data", (chunk) => {
            for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) {
                try {
                    const message = JSON.parse(line);
                    const pending = this.pending.get(message.id);
                    if (pending) {
                        clearTimeout(pending.timer);
                        this.pending.delete(message.id);
                        pending.resolve(message);
                    }
                }
                catch {
                    this.parseFailures += 1;
                }
            }
        });
    }
    request(method, params) {
        const id = this.nextId++;
        this.child?.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Timed out waiting for ${method}`));
            }, 2000);
            this.pending.set(id, { resolve, reject, timer });
        });
    }
    async stop() {
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer);
            pending.reject(new Error("client stopped"));
        }
        this.pending.clear();
        if (this.child && !this.child.killed) {
            this.child.kill("SIGKILL");
        }
    }
}
//# sourceMappingURL=mcpStdio.integration.test.js.map