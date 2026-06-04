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

// 创建工具实例
var sceneTools = new SceneTools();
var nodeTools = new NodeTools();
var componentTools = new ComponentTools();
var prefabTools = new PrefabTools();
var projectTools = new ProjectTools();

// 启动 MCP 服务器（端口 8585 或自动递增）
var server = new MCPServer(8585, {
    scene: sceneTools,
    node: nodeTools,
    component: componentTools,
    prefab: prefabTools,
    project: projectTools
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

## 注意事项

1. **端口冲突**: 如果 8585-8685 范围内所有端口都被占用，服务器启动失败
2. **进程清理**: 确保旧的 MCP 服务器进程已关闭，避免端口占用
3. **防火墙**: 确保 127.0.0.1 本地回环地址没有被防火墙阻止
