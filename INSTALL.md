# 如何安装 Cocos MCP Server 到编辑器

## 重要说明

⚠️ **版本兼容性**:
- **Cocos Creator 3.x**: 支持版本 3.8.6+
- **Cocos Creator 2.x**: 需要自定义集成方式（见下方）

---

## 方法 1：安装到 Cocos Creator 3.x（推荐）

### 步骤 1: 编译插件

```bash
cd D:\Users\PC\Desktop\heyafeng\cocos-mcp-server
npm install
npm run build
```

### 步骤 2: 安装到 Cocos Creator 3.x

**方式 A：通过扩展管理器**
1. 打开 Cocos Creator 3.x
2. 菜单栏 → `扩展` → `扩展管理器`
3. 选择 `项目` → `导入扩展`
4. 选择项目文件夹：`D:\Users\PC\Desktop\heyafeng\cocos-mcp-server`
5. 点击 `导入`

**方式 B：手动复制**
1. 将整个项目文件夹复制到你的 Cocos Creator 3.x 项目的 `packages` 目录：
```
<你的3.x项目>/packages/cocos-mcp-server/
```

2. 重启 Cocos Creator

### 步骤 3: 验证安装

打开 Cocos Creator 3.x 后：
- 菜单栏 → `扩展` → `Cocos MCP Server` → `打开面板`
- 应该能看到 MCP Server 控制面板

---

## 方法 2：集成到 Cocos Creator 2.x

由于此插件指定 `editor >= 3.8.6`，对于 **Cocos Creator 2.4.7** 需要使用独立 HTTP 服务器方式：

### 步骤 1: 编译 TypeScript

```bash
cd D:\Users\PC\Desktop\heyafeng\cocos-mcp-server
npm install
npm run build
```

### 步骤 2: 创建启动脚本

在你的 Cocos Creator 2.x 项目中创建 `mcp-server-start.js`：

```javascript
require('./path/to/cocos-mcp-server/cocos2x/mcp-server');

// 导入工具类（需要确保工具文件存在）
var SceneTools = require('./path/to/cocos-mcp-server/cocos2x/scene-tools').SceneTools;
var NodeTools = require('./path/to/cocos-mcp-server/cocos2x/node-tools').NodeTools;
var ComponentTools = require('./path/to/cocos-mcp-server/cocos2x/component-tools').ComponentTools;
var PrefabTools = require('./path/to/cocos-mcp-server/cocos2x/prefab-tools').PrefabTools;
var ProjectTools = require('./path/to/cocos-mcp-server/cocos2x/project-tools').ProjectTools;

// 创建工具实例（传入 Editor.Message 以调用编辑器功能）
var editorInterface = {
    sendMessage: function(target, method, args) {
        // Cocos Creator 2.x IPC 调用
        return Editor.Message.send(target, method, args);
    }
};

var sceneTools = new SceneTools(editorInterface);
var nodeTools = new NodeTools(editorInterface);
var componentTools = new ComponentTools(editorInterface);
var prefabTools = new PrefabTools(editorInterface);
var projectTools = new ProjectTools(editorInterface);

// 启动 MCP 服务器
var server = new MCPServer(8585, {
    scene: sceneTools,
    node: nodeTools,
    component: componentTools,
    prefab: prefabTools,
    project: projectTools
});

server.start().then(function() {
    console.log('✅ MCP Server for Cocos Creator 2.x started on port', server.port);
    console.log('📍 Health: http://127.0.0.1:' + server.port + '/health');
    console.log('🔧 MCP: http://127.0.0.1:' + server.port + '/mcp');
}).catch(function(err) {
    console.error('❌ Failed to start:', err);
});
```

### 步骤 3: 启动服务器

```bash
node mcp-server-start.js
```

### 步骤 4: 在扩展中调用（可选）

如果你想在 Cocos Creator 2.x 的扩展面板中启动 MCP Server，在你的扩展脚本中添加：

```javascript
// 在你的扩展的 panel/index.js 或脚本中
const { exec } = require('child_process');

// 启动 MCP 服务器
exec('node path/to/mcp-server-start.js', function(err, stdout, stderr) {
    if (err) {
        Editor.error('Failed to start MCP Server: ' + err);
    } else {
        Editor.log('MCP Server started');
        Editor.log(stdout);
    }
});
```

---

## 方法 3：作为全局 MCP 工具使用

如果你使用 Claude Desktop 或其他 MCP 客户端：

### 配置 Claude Desktop

创建或编辑 `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "cocos-creator-2x": {
      "command": "node",
      "args": [
        "D:/Users/PC/Desktop/heyafeng/cocos-mcp-server/mcp-start.js"
      ]
    }
  }
}
```

其中 `mcp-start.js` 使用方法 2 中创建的启动脚本。

---

## 验证安装

### 检查服务器状态

```bash
curl http://127.0.0.1:8585/health
```

**预期响应**:
```json
{
  "status": "ok",
  "tools": 60
}
```

### 测试工具调用

```bash
curl -X POST http://127.0.0.1:8585/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

---

## 故障排查

### 问题：端口 8585 被占用

**解决方案**: 端口会自动递增到 8586、8587... 直到找到可用端口

### 问题：无法连接到服务器

**检查清单**:
1. 服务器是否已启动？（查看进程：`tasklist | findstr node`）
2. 防火墙是否阻止了 127.0.0.1 连接？
3. 端口是否被其他程序占用？

### 问题：工具调用失败

**解决方案**: 确保 Cocos Creator 编辑器正在运行，且场景已加载

---

## 下一步

安装成功后，请参考：
- [SKILL.md](../.claude/skills/cocos-mcp/SKILL.md) - 完整工具使用说明
- [cocos2x/USAGE.md](cocos2x/USAGE.md) - Cocos Creator 2.x 集成说明
