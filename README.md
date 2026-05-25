# cursor-reader

Standalone TypeScript MCP module for Cursor workspace tracking and safe metadata extraction.

Features:
- Watch allowed project roots
- Detect add/change/delete events
- Track Git changes locally
- Store recent file events
- Ignore common build and VCS directories
- Block unsafe files like `.env`, `.pem`, and private keys
- Detect Cursor artifacts such as `.cursor`, `workspaceStorage`, and `state.vscdb`
- Expose MCP-style tools for project inspection and safe metadata retrieval

## Available tools

- `list_projects`
- `get_project_tree`
- `read_file`
- `search_code`
- `get_recent_changes`
- `get_latest_git_diff`
- `get_prompt_history`

## Build

```bash
cd mcp/cursor-reader
npm install
npm run build
```

## Run

```bash
npm start
```

Use environment variables to configure the server:

```bash
CURSOR_READER_ROOTS="/path/to/project" npm start
CURSOR_READER_PORT=4600 npm start
```

## Run tests

```bash
npm test
```

## Example RPC request

```bash
curl -X POST http://localhost:4500/rpc \
  -H 'Content-Type: application/json' \
  -d '{"tool":"list_projects"}'
```

```bash
curl -X POST http://localhost:4500/rpc \
  -H 'Content-Type: application/json' \
  -d '{"tool":"get_prompt_history"}'
```
