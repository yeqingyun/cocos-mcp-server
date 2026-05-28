# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cocos Creator MCP Server plugin — an HTTP-based MCP (Model Context Protocol) server that runs inside the Cocos Creator editor, exposing 50+ tools over JSON-RPC 2.0 so AI assistants can control the editor. Requires Cocos Creator **3.8.6+**.

## Build Commands

```bash
npm install          # Install dependencies (runs preinstall script)
npm run build        # Compile TypeScript → dist/  (tsc)
npm run watch        # Compile in watch mode (tsc -w)
```

No test runner is configured. Test files in `source/test/` are standalone scripts that connect to a running MCP server.

## Architecture

### Extension lifecycle

- `source/main.ts` — Plugin entry point. Exports `load()` / `unload()` and an IPC `methods` object. On load it creates `MCPServer` and `ToolManager` instances; if `autoStart` is set, the HTTP server starts immediately.
- `source/scene.ts` — Runs in the **scene process** (not the main process). Uses `require('cc')` to access Cocos runtime APIs (`director`, `Node`, `js`, etc.). Registered via `contributions.scene` in `package.json`.

### MCP Server (`source/mcp-server.ts`)

- Pure HTTP server (no WebSocket). Listens on a configurable port (default 3000).
- Endpoints: `POST /mcp` (JSON-RPC 2.0), `GET /health`, `POST /api/{category}/{tool_name}`, `GET /api/tools`.
- Protocol methods: `initialize`, `tools/list`, `tools/call`.
- Tool routing: tool names follow `{category}_{method}` pattern. The server splits on `_`, looks up the category in `this.tools`, and calls `.execute(method, args)`.

### Tool pattern

All tools implement the `ToolExecutor` interface (`source/types/index.ts`):

```typescript
interface ToolExecutor {
    getTools(): ToolDefinition[];
    execute(toolName: string, args: any): Promise<ToolResponse>;
}
```

- `getTools()` returns an array of `ToolDefinition` (name, description, JSON Schema input).
- `execute()` dispatches by `toolName` to private methods.
- Every tool method returns `ToolResponse` with `{ success, data?, error?, message?, warning? }`.

Tool files live in `source/tools/`. Each file exports one class. Registered in two places: `MCPServer.initializeTools()` and `ToolManager.initializeAvailableTools()`.

### Dual-API strategy

Editor operations use two approaches with fallback:
1. **Editor IPC** — `Editor.Message.request('scene', 'query-node-tree')`, `Editor.Message.request('asset-db', 'query-assets', ...)` etc. This is the primary path.
2. **Scene script** — `Editor.Message.request('scene', 'execute-scene-script', { name, method, args })`. Runs code in the scene process via `source/scene.ts`. Used as fallback.

### Settings persistence

- `source/settings.ts` — Reads/writes JSON files to `{project}/settings/mcp-server.json` and `{project}/settings/tool-manager.json` using `Editor.Project.path`.
- `source/tools/tool-manager.ts` — Manages tool enable/disable configurations with import/export support.

### Panels

- `source/panels/default/` — Vue 3 panel for server controls and tool management.
- `source/panels/tool-manager/` — Vanilla JS panel for advanced tool configuration.

## Key Editor IPC messages used

| Target | Message | Purpose |
|--------|---------|---------|
| `scene` | `query-node-tree` | Get scene hierarchy |
| `scene` | `open-scene` | Open scene by UUID |
| `scene` | `save-scene` | Save current scene |
| `scene` | `close-scene` | Close current scene |
| `scene` | `execute-scene-script` | Run code in scene process |
| `asset-db` | `query-assets` | Query assets by pattern |
| `asset-db` | `query-uuid` | Look up UUID by path |
| `asset-db` | `create-asset` | Create asset file |

## TypeScript configuration

- `base.tsconfig.json` — Target ES2017, CommonJS modules, strict mode.
- `tsconfig.json` — Extends base, adds `@cocos/creator-types/editor` types.
- Source in `source/`, compiled output in `dist/`.
