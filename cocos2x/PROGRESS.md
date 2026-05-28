# Cocos Creator 2.x MCP Server - 重写进度

## 概述
基于 Cocos Creator 3.x 版本的 MCP Server 插件，为 2.4.7 创建兼容版本。

## 文件结构

```
cocos2x/
├── package.json          # 2.x 扩展配置（完成）
├── main.js               # 入口文件（完成）
├── mcp-server.js          # MCP HTTP 服务器（完成）
├── scene-tools.js         # 场景工具（完成）
├── scene-script.js        # 场景脚本（完成）
├── node-tools.js          # 节点工具（完成）
├── component-tools.js     # 组件工具（完成）
├── prefab-tools.js        # 预制体工具（完成）
├── project-tools.js       # 项目工具（完成）
├── debug-tools.js         # 调试工具（完成）
└── PROGRESS.md            # 进度记录
```

## 工具类别与工具列表

### Scene 工具（scene-tools.js）

| 工具 | 状态 | 备注 |
|------|------|------|
| `get_current_scene` | 已验证 | `cc.director.getScene()` |
| `get_scene_list` | 已验证 | `Editor.assetdb.queryAssets` |
| `open_scene` | 已验证 | `Editor.Ipc sendToPanel` fallback |
| `save_scene` | 已验证 | `Editor.Ipc scene:stash-and-save` fire-and-forget |
| `create_scene` | 已验证 | `Editor.assetdb.create` |
| `close_scene` | 已验证 | `Editor.Ipc scene:new-scene` fire-and-forget |
| `get_scene_hierarchy` | 已验证 | `cc.director.getScene()` 递归 |

### Node 工具（node-tools.js）

| 工具 | 状态 | 备注 |
|------|------|------|
| `create_node` | 已验证 | `new cc.Node()` + `addChild` |
| `get_node_info` | 已验证 | `findNodeByUuid` / `cc.find()` |
| `find_nodes` | 已验证 | 递归搜索 by name pattern |
| `get_all_nodes` | 已验证 | 遍历全场景节点 |
| `set_node_property` | 已验证 | name/active/position/scale/rotation/size/color |
| `delete_node` | 已验证 | `removeFromParent` + `destroy` |
| `move_node` | 已验证 | `removeFromParent` + `insertChild` |
| `duplicate_node` | 已验证 | `cc.instantiate` |

### Component 工具（component-tools.js）

| 工具 | 状态 | 备注 |
|------|------|------|
| `add_component` | 已验证 | `node.addComponent()` |
| `remove_component` | 已验证 | `node.removeComponent()` |
| `get_components` | 已验证 | `node._components` 遍历 |
| `set_component_property` | 已验证 | 直接属性赋值 |
| `get_component_info` | 已验证 | 仅返回基础类型属性（避免序列化错误） |
| `get_available_components` | 已验证 | 静态组件列表 |

### Prefab 工具（prefab-tools.js）

| 工具 | 状态 | 备注 |
|------|------|------|
| `get_prefab_list` | 已验证 | `Editor.assetdb.queryAssets` |
| `instantiate_prefab` | 已验证 | `cc.assetManager.loadAny` + `cc.instantiate` |
| `get_prefab_info` | 已验证 | `Editor.assetdb.assetInfoByUuid` 同步方法 |

### Project 工具（project-tools.js）

| 工具 | 状态 | 备注 |
|------|------|------|
| `get_project_info` | 已验证 | `Editor.Project` / process |
| `get_assets` | 已验证 | `Editor.assetdb.queryAssets` by type |
| `get_asset_info` | 已验证 | `Editor.assetdb.assetInfoByUuid` |
| `query_asset_uuid` | 已验证 | `Editor.assetdb.urlToUuid` 同步方法 |
| `refresh_assets` | 已验证 | `Editor.assetdb.refresh` |
| `create_asset` | 已验证 | `Editor.assetdb.create` |
| `delete_asset` | 已验证 | `Editor.assetdb.delete` |

### Debug 工具（debug-tools.js）

| 工具 | 状态 | 备注 |
|------|------|------|
| `execute_script` | 已验证 | `eval()` in scene context |
| `get_editor_info` | 已验证 | Editor.versions / process |
| `get_project_logs` | 已验证 | 读取 temp/logs/project.log（文件不存在时返回错误） |
| `get_console_logs` | 已验证 | 拦截 cc.log/warn/error |

## MCP 协议层

| 功能 | 状态 | 备注 |
|------|------|------|
| HTTP 服务器 | 已验证 | 自动启动，端口 8585 |
| JSON-RPC 2.0 | 已验证 | initialize/tools/list/tools/call 均通过 |
| 工具路由 | 已验证 | `category_method` 模式正常 |
| 健康检查 | 已验证 | GET /health 返回 ok |

## 已知问题

- main-menu 消息路由未通（菜单点击报 sendToMain failed），服务器改为自动启动绕过此问题
- 待后续排查 Cocos 2.x 的 messages 路由机制

## 待完成

- [ ] 控制面板 UI
- [ ] main-menu 消息路由修复
