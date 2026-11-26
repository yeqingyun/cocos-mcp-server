# 如何在 Cocos Creator 2.x 中应用端口递增逻辑

## 概述

`cocos2x/mcp-server.js` 已添加端口自动递增功能：
- 默认端口 8585 被占用时，自动尝试 8586、8587...
- 最多尝试递增 100 个端口（8585~8685）

## 方法 1：作为独立 HTTP MCP 服务器使用

在你的 Cocos Creator 2.x 项目中创建启动脚本：

```javascript
// mcp-start.js
require('./cocos2x/mcp-server');

var SceneTools = require('./cocos2x/scene-tools');
var NodeTools = require('./cocos2x/node-tools');
var ComponentTools = require('./cocos2x/component-tools');
var PrefabTools = require('./cocos2x/prefab-tools');
var ProjectTools = require('./cocos2x/project-tools');
var ScreenshotTools = require('./cocos2x/screenshot-tools');

// 创建工具实例
var sceneTools = new SceneTools();
var nodeTools = new NodeTools();
var componentTools = new ComponentTools();
var prefabTools = new PrefabTools();
var projectTools = new ProjectTools();
var screenshotTools = new ScreenshotTools.ScreenshotTools();

// 启动 MCP 服务器（端口 8585 或自动递增）
var server = new MCPServer(8585, {
    scene: sceneTools,
    node: nodeTools,
    component: componentTools,
    prefab: prefabTools,
    project: projectTools,
    screenshot: screenshotTools
});

server.start().then(function() {
    console.log('MCP Server started successfully!');
}).catch(function(err) {
    console.error('Failed to start MCP Server:', err);
});
```

**执行启动**:
```bash
node mcp-start.js
```

## 方法 2：集成到 Cocos Creator 2.x 扩展中

在你的扩展的 `scene.ts` 中添加 MCP 服务器启动逻辑：

```typescript
// 在你的扩展的 scene.ts 中
const MCPServer = require('./path/to/cocos2x/mcp-server').MCPServer;

let mcpServerInstance = null;

export const methods = {
    // 启动 MCP 服务器
    async startMCPServer() {
        if (!mcpServerInstance) {
            // 初始化工具实例
            const tools = {
                scene: new SceneTools(),
                node: new NodeTools(),
                component: new ComponentTools(),
                prefab: new PrefabTools(),
                project: new ProjectTools()
            };

            mcpServerInstance = new MCPServer(8585, tools);
        }

        try {
            await mcpServerInstance.start();
            Editor.log('[MCP] Server started successfully');
            return { success: true, port: mcpServerInstance.port };
        } catch (error) {
            Editor.log('[MCP] Failed to start server: ' + error.message);
            return { success: false, error: error.message };
        }
    },

    // 停止 MCP 服务器
    stopMCPServer() {
        if (mcpServerInstance) {
            mcpServerInstance.stop();
            mcpServerInstance = null;
            Editor.log('[MCP] Server stopped');
            return { success: true };
        }
        return { success: false, error: 'Server not running' };
    },

    // 获取服务器状态
    getMCPStatus() {
        if (!mcpServerInstance) {
            return { running: false, port: null };
        }
        const status = mcpServerInstance.getStatus();
        return {
            running: status.running,
            port: status.port,
            tools: mcpServerInstance.getAvailableTools().length
        };
    }
};
```

## 端口自动递增行为

当端口被占用时的输出示例：

```
[MCPServer 2x] Port 8585 is in use, trying port 8586...
[MCPServer 2x] HTTP server started on http://127.0.0.1:8586
[MCPServer 2x] MCP endpoint: http://127.0.0.1:8586/mcp
[MCPServer 2x] Note: Original port 8585 was in use, using port 8586
```

## 验证服务器是否运行

```bash
# 检查健康状态
curl http://127.0.0.1:8585/health

# 获取可用工具列表
curl http://127.0.0.1:8585/api/tools

# 测试工具调用
curl -X POST http://127.0.0.1:8585/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## 场景截图工具 (screenshot)

`screenshot_capture_scene` 用场景里的 Camera 把当前场景渲染成 PNG 截图，**以 MCP `image` 内容块内联返回**（调用方可直接看到图），并可选 `savePath` 存盘。

- 捕获的是**游戏相机视角**（Camera 组件所见），不是编辑器视口的 gizmo / 网格 / 选中高亮。
- **无需场景里有 Camera**：没传 `cameraUuid` 且场景无相机时，会自动建临时正交相机取景，截完销毁。
- 基于 2.x 引擎 API：`new cc.RenderTexture()` → `initWithSize(w,h)` → `camera.targetTexture = tex` → `camera.render()` → `tex.readPixels()`。

参数：`width`、`height`、`cameraUuid`(可选)、`targetNodeUuid`(可选)、`savePath`(可选)。

**取景规则（优先级）：**
1. 传 `cameraUuid` → 用指定相机。
2. 传 `targetNodeUuid` → 自动建临时相机，**只框该节点子树**（排除兄弟/父级）。
3. 都不传且场景有相机 → 用第一个相机。
4. 都不传且无相机（如预制体）→ 自动建临时相机**框整个场景**。

```bash
# 默认 512x512 截图，内联返回
curl -X POST http://127.0.0.1:8585/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"screenshot_capture_scene","arguments":{"width":512,"height":512}}}'

# 截图并存盘
curl -X POST http://127.0.0.1:8585/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"screenshot_capture_scene","arguments":{"savePath":"db://assets/snap.png"}}}'

# 只截某个节点子树（自动建临时相机，紧框该子树）
curl -X POST http://127.0.0.1:8585/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"screenshot_capture_scene","arguments":{"targetNodeUuid":"<NODE_UUID>","width":300,"height":300}}}'
```

注意事项：
1. 若图**上下颠倒**，去掉 `screenshot-tools.js` 里 `pngEncoder.flipVertically(...)` 那行（个别 2.x 小版本 `readPixels` 取向不同）。
2. 临时改动相机 `targetTexture` 后会立即恢复，正常不影响编辑器；理论上可能让场景标记为 dirty，必要时手动保存。

## 注意事项

1. **端口冲突**: 如果 8585-8685 范围内所有端口都被占用，服务器启动失败
2. **进程清理**: 确保旧的 MCP 服务器进程已关闭，避免端口占用
3. **防火墙**: 确保 127.0.0.1 本地回环地址没有被防火墙阻止

## 工具列表（tools/list）

| 分类 | 工具 |
|------|------|
| scene_* | get_current_scene / get_scene_list / open_scene / save_scene / create_scene / close_scene / get_scene_hierarchy |
| node_* | 节点创建/删除/查找/属性/移动等 |
| component_* | 组件增删查改 |
| prefab_* | get_prefab_list / **open_prefab** / **get_prefab_edit_state** / load_prefab / instantiate_prefab / create_prefab / update_prefab / revert_prefab / get_prefab_info / validate_prefab / duplicate_prefab / restore_prefab_node |
| project_* | 资产查询/创建/删除/刷新等 |
| debug_* | execute_script / get_editor_info / get_project_logs / get_console_logs |
| screenshot_* | capture_scene |

### prefab_open_prefab —— 真正打开 prefab 编辑模式

`prefab_load_prefab` 只是内存加载，不会打开编辑器 prefab 编辑模式。`open_prefab` 走的是 assets 面板双击 prefab 的同一条 IPC：

```json
{"name":"prefab_open_prefab","arguments":{"prefabUuid":"<PREFAB_UUID>","saveBeforeOpen":false}}
```

- 实现：主进程 `Editor.Ipc.sendToPanel('scene', 'scene:enter-prefab-edit-mode', uuid)`（sendToScene 兜底），随后轮询场景进程 `query-prefab-edit-state` 校验已切入（场景根子节点 `_prefab.assetId === 目标 uuid`），最长 ~6s。
- `saveBeforeOpen: true` 时切换前先发 `scene:stash-and-save` 落盘当前打开的场景/prefab（默认 false，不做静默保存）。
- 幂等：目标 prefab 已在编辑模式时直接返回 `alreadyOpen: true`，不重载。
- 完整闭环：`prefab_open_prefab` → `debug_execute_script` 改节点 → `scene_save_scene`（prefab 模式下 stash-and-save 直接写 .prefab 文件）。

### prefab_get_prefab_edit_state —— 查询当前编辑模式状态

```json
{"name":"prefab_get_prefab_edit_state","arguments":{}}
```

返回 `{ inPrefabEditMode, editedPrefabUuid, editedRootName }`，用于确认当前场景面板处于哪个 prefab 的编辑模式（或处于普通场景模式）。

### 扩展改动后的生效方式

改 `*.js` 后无需重启整个编辑器：在场景面板进程执行 `Editor.Package.reload('cocos-mcp-server-2x')` 即可热加载（会软重载场景面板，8585 服务短暂中断几秒）。主进程侧代码（main.js / *-tools.js）与场景进程侧代码（scene-script.js）都会重新加载。
