---
name: cocos-mcp
description: "Cocos Creator MCP Server 操作技能：通过 HTTP JSON-RPC 2.0 协议调用 MCP 工具控制 Cocos Creator 2.x 编辑器，涵盖场景、节点、组件、预制体、项目管理等操作"
license: Proprietary.
---

# Cocos Creator MCP Server 操作技能

通过 HTTP JSON-RPC 2.0 协议与 Cocos Creator 2.x 编辑器交互。默认端口 **8585**。

## 基础调用方式

所有请求格式：
```bash
curl -s -X POST http://localhost:8585/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"<tool_name>","arguments":{<args>}}}'
```

---

## 一、场景操作 (scene)

### 创建新场景并打开
```bash
# 1. 创建场景文件
curl -s -X POST http://localhost:8585/mcp -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"scene_create_scene","arguments":{"sceneName":"MyScene","savePath":"db://assets/MyScene.fire"}}}'

# 2. 关闭当前场景
curl -s -X POST http://localhost:8585/mcp -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"scene_close_scene","arguments":{}}}'

# 3. 打开新场景（用步骤1返回的UUID）
curl -s -X POST http://localhost:8585/mcp -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"scene_open_scene","arguments":{"sceneUuid":"<UUID>"}}}'
```

### 其他场景操作
```bash
# 获取当前场景信息
scene_get_current_scene

# 获取项目中所有场景列表
scene_get_scene_list

# 获取场景层级结构（includeComponents=true 包含组件信息）
scene_get_scene_hierarchy  {"includeComponents": true}

# 保存当前场景
scene_save_scene

# 关闭当前场景
scene_close_scene
```

---

## 二、节点操作 (node)

### 创建节点
```bash
# 在场景根节点创建
node_create_node  {"name": "MyNode"}

# 指定父节点（用路径）
node_create_node  {"name": "Child", "parentPath": "Canvas/Bg"}

# 指定初始位置
node_create_node  {"name": "Player", "parentPath": "Canvas", "position": {"x": 100, "y": 200}}
```

### 查询节点
```bash
# 通过路径或UUID获取节点信息
node_get_node_info  {"uuidOrPath": "Canvas/Bg/Sprite"}

# 按名称搜索节点
node_find_nodes  {"pattern": "Camera", "exactMatch": true}

# 获取场景中所有节点
node_get_all_nodes
```

### 修改节点属性
```bash
# 支持的属性：name, active, x, y, scaleX, scaleY, rotation, width, height, anchorX, anchorY, opacity, color
node_set_node_property  {"uuid": "<UUID>", "property": "width", "value": 500}
node_set_node_property  {"uuid": "<UUID>", "property": "x", "value": 100}
```

### 其他节点操作
```bash
# 删除节点
node_delete_node  {"uuid": "<UUID>"}

# 移动节点到新父节点
node_move_node  {"nodeUuid": "<UUID>", "newParentUuid": "<PARENT_UUID>"}

# 复制节点
node_duplicate_node  {"uuid": "<UUID>"}
```

---

## 三、组件操作 (component)

### 添加/移除组件
```bash
# 添加组件（常用类型：cc.Sprite, cc.Label, cc.Button, cc.Camera, cc.Canvas, cc.Widget, cc.AudioSource 等）
component_add_component  {"nodeUuid": "<UUID>", "componentType": "cc.Sprite"}

# 移除组件
component_remove_component  {"nodeUuid": "<UUID>", "componentType": "cc.Sprite"}

# 查看节点所有组件
component_get_components  {"nodeUuid": "<UUID>"}

# 查看可用组件类型（category: all, renderer, ui, physics, audio, layout）
component_get_available_components  {"category": "ui"}
```

### 设置组件属性
```bash
# 通用属性设置
component_set_component_property  {"nodeUuid": "<UUID>", "componentType": "cc.Label", "property": "string", "value": "Hello"}
component_set_component_property  {"nodeUuid": "<UUID>", "componentType": "cc.Label", "property": "fontSize", "value": 32}

# 获取组件详情
component_get_component_info  {"nodeUuid": "<UUID>", "componentType": "cc.Sprite"}
```

---

## 四、预制体操作 (prefab)

```bash
# 获取预制体列表
prefab_get_prefab_list

# 实例化预制体到场景
prefab_instantiate_prefab  {"prefabUuid": "<UUID>", "parentPath": "Canvas"}

# 获取预制体信息
prefab_get_prefab_info  {"prefabUuid": "<UUID>"}
```

---

## 五、项目操作 (project)

```bash
# 获取项目信息
project_get_project_info

# 按类型查询资源（type: all, scene, prefab, script, texture, audio, animation）
project_get_assets  {"type": "texture"}

# 通过UUID获取资源信息
project_get_asset_info  {"uuid": "<UUID>"}

# 通过URL查询资源UUID
project_query_asset_uuid  {"url": "db://assets/Texture/HelloWorld.png"}

# 刷新资源数据库
project_refresh_assets  {"folder": "db://assets"}

# 创建资源文件
project_create_asset  {"url": "db://assets/scripts/NewScript.js", "content": "// script"}

# 删除资源
project_delete_asset  {"url": "db://assets/old.fire"}
```

---

## 六、调试工具 (debug)

```bash
# 在场景上下文中执行 JavaScript（可直接访问 cc, _Scene 等）
debug_execute_script  {"script": "return cc.director.getScene().name"}

# 获取编辑器信息
debug_get_editor_info

# 获取项目日志
debug_get_project_logs  {"lines": 50, "filterKeyword": "error"}

# 获取场景控制台日志
debug_get_console_logs  {"limit": 30}
```

---

## 重要注意事项

### 1. 创建新场景的完整流程（必须按此顺序）

创建的 `.fire` 文件是最小场景，不含 Canvas 和 Camera。必须手动创建：

```
1. scene_create_scene  → 创建场景文件
2. scene_close_scene   → 关闭当前场景
3. scene_open_scene    → 打开新场景（用返回的UUID）
4. 等待 ~2秒让场景加载完成
5. node_create_node("Canvas")  → 创建Canvas节点（不加parentPath，挂在场景根）
6. component_add_component("cc.Canvas")  → 给Canvas加组件
7. node_set_node_property(x=480, y=320)  → 设置Canvas居中位置
8. 创建 Main Camera、Bg 等子节点时用 parentPath: "Canvas"
```

### 2. 设置 spriteFrame 的注意事项

- **传入纹理 UUID 即可**，MCP 会自动从纹理的 .meta 文件中查找对应的 sprite-frame 子资源 UUID
- value 格式为 `{"__uuid__": "<纹理UUID>", "__type__": "cc.SpriteFrame"}`
- spriteFrame 异步加载后会**自动重置节点尺寸为纹理原始大小**
- **设置顺序：先加 cc.Sprite 组件 → 设 spriteFrame → 最后设 width/height**

```bash
# 正确顺序
1. component_add_component(cc.Sprite)
2. component_set_component_property(_spriteFrame, {"__uuid__": "..."})
3. node_set_node_property(width, 500)
4. node_set_node_property(height, 550)
```

### 3. 保存场景

- 使用 `scene_save_scene` 保存，**不会弹出文件对话框**
- 前提：场景必须通过 `scene_open_scene` 打开（内部使用 `_Scene.loadSceneByUuid`）
- 如果保存走了 fallback 会弹出对话框，检查流程是否正确

### 4. 父节点路径

- `parentPath` 使用 `/` 分隔的节点路径，如 `"Canvas/Bg/Sprite"`
- 如果 `cc.find(parentPath)` 找不到节点，会 fallback 到场景根节点
- **确保父节点已存在**再创建子节点

### 5. 场景操作间隔

- `scene_open_scene` 后需等待约 **2秒** 让编辑器完成加载
- `scene_close_scene` 后等待约 **1秒**
- 可用 `scene_get_scene_hierarchy` 确认场景是否加载完成

### 6. UUID vs 路径

- `node_get_node_info` 和 `node_delete_node` 等接口支持 UUID 或路径（如 `"Canvas/Bg"`）
- 路径中含 `/` 时会被当作路径解析，不含 `/` 时先尝试 `cc.find` 再尝试 UUID 查找
- **推荐创建节点后保存返回的 UUID**，后续操作用 UUID 更可靠

### 7. 组件属性名

- 内部属性用下划线前缀：`_spriteFrame`、`_N$spriteFrame`（旧版）
- 常用属性可直接用：`string`、`fontSize`、`color`、`enabled`
- 颜色值格式：`{"r": 255, "g": 0, "b": 0, "a": 255}`
