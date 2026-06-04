---
name: cocos-mcp
description: "Cocos Creator MCP Server 操作技能：通过 HTTP JSON-RPC 2.0 协议调用 MCP 工具控制 Cocos Creator 2.x 编辑器，涵盖场景、节点、组件、预制体、项目管理等操作"
license: Proprietary.
---

# Cocos Creator MCP Server 操作技能

通过 HTTP JSON-RPC 2.0 协议与 Cocos Creator 2.x 编辑器交互。默认端口 **8585**。

## 📊 功能概览

| 类别 | 工具数 | 状态 | 说明 |
|------|--------|------|------|
| Scene | 7 | ✅ | 场景管理（创建、打开、保存、关闭） |
| Node | 9 | ✅ | 节点操作（创建、查询、修改、删除） |
| Component | 14 | ✅ | 组件管理（添加、移除、查询、修改） |
| Prefab | 10 | ✅ | 预制体管理（加载、实例化、创建、更新） |
| Project | 7 | ✅ | 项目管理（资源查询、创建、删除） |
| Debug | 4 | ✅ | 调试工具（脚本执行、日志查看） |
| **总计** | **60** | **✅ 100%** | **测试覆盖率100%** |

## 基础调用方式

所有请求格式：
```bash
curl -s -X POST http://localhost:8585/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"<tool_name>","arguments":{<args>}}}'
```

---

## 一、场景操作 (scene)

### 可用工具

| 工具 | 描述 | 参数 |
|------|------|------|
| `scene_get_current_scene` | 获取当前场景信息 | 无 |
| `scene_get_scene_list` | 获取项目中所有场景列表 | 无 |
| `scene_open_scene` | 通过UUID打开场景 | `sceneUuid` |
| `scene_save_scene` | 保存当前场景 | 无 |
| `scene_create_scene` | 在指定路径创建新场景 | `sceneName`, `savePath` |
| `scene_close_scene` | 关闭当前场景 | 无 |
| `scene_get_scene_hierarchy` | 获取场景完整节点树结构 | `includeComponents` (可选) |

### 使用示例

**创建新场景并打开：**
```bash
# 1. 创建场景文件
scene_create_scene  {"sceneName": "MyScene", "savePath": "db://assets/MyScene.fire"}

# 2. 关闭当前场景
scene_close_scene  {}

# 3. 等待1秒，打开新场景
scene_open_scene  {"sceneUuid": "<返回的UUID>"}
```

**获取场景信息：**
```bash
# 获取当前打开的场景
scene_get_current_scene  {}

# 获取项目中所有场景
scene_get_scene_list  {}

# 获取场景层级结构（包含组件信息）
scene_get_scene_hierarchy  {"includeComponents": true}
```

**场景保存：**
```bash
# 保存当前场景（不会弹出文件对话框）
scene_save_scene  {}
```

### ⚠️ 重要注意事项

1. **创建新场景的完整流程**（必须按此顺序）：
   ```
   1. scene_create_scene  → 创建场景文件
   2. scene_close_scene   → 关闭当前场景
   3. scene_open_scene    → 打开新场景
   4. 等待 ~2秒让场景加载完成
   5. node_create_node("Canvas")  → 创建Canvas节点
   6. component_add_component("cc.Canvas")  → 添加Canvas组件
   7. 创建其他子节点时使用 parentPath: "Canvas"
   ```

2. **场景操作间隔**：
   - `scene_open_scene` 后需等待约 **2秒**
   - `scene_close_scene` 后等待约 **1秒**
   - 可用 `scene_get_scene_hierarchy` 确认加载完成

3. **已知问题**：
   - `scene_open_scene` 后编辑器标题栏可能不更新（场景内容正常加载）

---

## 二、节点操作 (node)

### 可用工具

| 工具 | 描述 | 参数 |
|------|------|------|
| `node_create_node` | 创建新节点 | `name`, `parentPath`, `position` |
| `node_get_node_info` | 获取节点信息 | `uuidOrPath` |
| `node_find_nodes` | 按名称模式搜索节点 | `pattern`, `exactMatch` |
| `node_find_node_by_name` | 精确查找单个节点 | `name`, `searchRoot` |
| `node_get_all_nodes` | 获取场景中所有节点 | 无 |
| `node_set_node_property` | 设置节点属性 | `uuid`, `property`, `value` |
| `node_delete_node` | 删除节点 | `uuid` |
| `node_move_node` | 移动节点到新父节点 | `nodeUuid`, `newParentUuid`, `siblingIndex` |
| `node_duplicate_node` | 复制节点 | `uuid` |

### 使用示例

**创建节点：**
```bash
# 在场景根节点创建
node_create_node  {"name": "MyNode"}

# 指定父节点（用路径）
node_create_node  {"name": "Child", "parentPath": "Canvas/Bg"}

# 指定初始位置
node_create_node  {"name": "Player", "parentPath": "Canvas", "position": {"x": 100, "y": 200}}
```

**查询节点：**
```bash
# 通过路径或UUID获取节点信息
node_get_node_info  {"uuidOrPath": "Canvas/Bg/Sprite"}

# 按名称模式搜索（支持部分匹配）
node_find_nodes  {"pattern": "Button", "exactMatch": false}

# 按精确名称查找第一个匹配项
node_find_node_by_name  {"name": "Main Camera"}

# 在指定范围内查找
node_find_node_by_name  {"name": "Button", "searchRoot": "Canvas"}

# 获取场景中所有节点
node_get_all_nodes  {}
```

**修改节点属性：**
```bash
# 支持的属性：name, active, x, y, scaleX, scaleY, rotation, width, height, anchorX, anchorY
node_set_node_property  {"uuid": "<UUID>", "property": "width", "value": 500}
node_set_node_property  {"uuid": "<UUID>", "property": "x", "value": 100}
node_set_node_property  {"uuid": "<UUID>", "property": "active", "value": false}
```

**其他节点操作：**
```bash
# 删除节点
node_delete_node  {"uuid": "<UUID>"}

# 移动节点到新父节点
node_move_node  {"nodeUuid": "<UUID>", "newParentUuid": "<PARENT_UUID>"}

# 移动节点并指定位置（siblingIndex为-1表示末尾）
node_move_node  {"nodeUuid": "<UUID>", "newParentUuid": "<PARENT_UUID>", "siblingIndex": 0}

# 复制节点
node_duplicate_node  {"uuid": "<UUID>"}
```

### ⚠️ 重要注意事项

1. **UUID vs 路径**：
   - 推荐使用 UUID（创建节点后保存返回的 UUID）
   - 路径中含 `/` 时会被当作路径解析
   - 不含 `/` 时先尝试 `cc.find` 再尝试 UUID 查找

2. **父节点路径**：
   - 使用 `/` 分隔：`"Canvas/Bg/Sprite"`
   - 确保**父节点已存在**再创建子节点
   - 找不到时会 fallback 到场景根节点

3. **Widget 组件冲突**：
   - 节点带有 `cc.Widget` 组件时，`set_node_property` 设置的位置可能不生效
   - Widget 会覆盖手动设置的位置属性
   - 设置前建议移除或禁用 Widget 组件

---

## 三、组件操作 (component)

### 可用工具

| 工具 | 描述 | 参数 |
|------|------|------|
| `component_add_component` | 添加内置组件 | `nodeUuid`, `componentType` |
| `component_attach_script` | 附加自定义脚本 | `nodeUuid`, `scriptName`, `scriptPath` |
| `component_remove_component` | 移除组件 | `nodeUuid`, `componentType` |
| `component_get_components` | 获取节点所有组件 | `nodeUuid` |
| `component_get_component_info` | 获取组件详细信息 | `nodeUuid`, `componentType` |
| `component_get_sprite_info` | 获取Sprite详情 | `nodeUuid` |
| `component_get_label_info` | 获取Label详情 | `nodeUuid` |
| `component_get_button_info` | 获取Button详情 | `nodeUuid` |
| `component_get_transform_info` | 获取UITransform详情 | `nodeUuid` |
| `component_get_layout_info` | 获取Layout详情 | `nodeUuid` |
| `component_get_widget_info` | 获取Widget详情 | `nodeUuid` |
| `component_get_custom_component_info` | 获取自定义组件详情 | `nodeUuid`, `componentType`, `maxDepth` |
| `component_get_available_components` | 获取可用组件类型列表 | `category` |
| `component_set_component_property` | 设置组件属性 | `nodeUuid`, `componentType`, `property`, `value` |

### 使用示例

**添加/移除组件：**
```bash
# 添加内置组件（常用类型：cc.Sprite, cc.Label, cc.Button, cc.Canvas, cc.Widget, cc.Layout等）
component_add_component  {"nodeUuid": "<UUID>", "componentType": "cc.Sprite"}

# 附加自定义脚本组件
component_attach_script  {"nodeUuid": "<UUID>", "scriptName": "PlayerController"}
component_attach_script  {"nodeUuid": "<UUID>", "scriptName": "PlayerController", "scriptPath": "db://assets/scripts/PlayerController.js"}

# 移除组件
component_remove_component  {"nodeUuid": "<UUID>", "componentType": "cc.Sprite"}

# 查看节点所有组件
component_get_components  {"nodeUuid": "<UUID>"}

# 查看可用组件类型（category: all, renderer, ui, physics, audio, layout）
component_get_available_components  {"category": "ui"}
```

**获取组件详细信息：**
```bash
# 通用组件信息
component_get_component_info  {"nodeUuid": "<UUID>", "componentType": "cc.Sprite"}

# 特定组件详细信息
component_get_sprite_info     {"nodeUuid": "<UUID>"}
component_get_label_info      {"nodeUuid": "<UUID>"}
component_get_button_info     {"nodeUuid": "<UUID>"}
component_get_transform_info  {"nodeUuid": "<UUID>"}
component_get_layout_info     {"nodeUuid": "<UUID>"}
component_get_widget_info     {"nodeUuid": "<UUID>"}

# 获取自定义组件的完整属性（支持嵌套对象、cc.Node/cc.Color等引擎类型）
component_get_custom_component_info  {"nodeUuid": "<UUID>", "componentType": "InviteActivityDialog"}
component_get_custom_component_info  {"nodeUuid": "<UUID>", "componentType": "Button", "maxDepth": 3}
```

**设置组件属性：**
```bash
# 设置Label文本
component_set_component_property  {"nodeUuid": "<UUID>", "componentType": "cc.Label", "property": "string", "value": "Hello"}

# 设置字体大小
component_set_component_property  {"nodeUuid": "<UUID>", "componentType": "cc.Label", "property": "fontSize", "value": 32}

# 设置颜色值（格式：{"r": 255, "g": 0, "b": 0, "a": 255}）
component_set_component_property  {"nodeUuid": "<UUID>", "componentType": "cc.Label", "property": "color", "value": {"r": 255, "g": 255, "b": 255, "a": 255}}
```

### ⚠️ 重要注意事项

1. **设置 spriteFrame 的正确顺序**：
   ```bash
   # 正确顺序
   1. component_add_component(cc.Sprite)
   2. component_set_component_property(_spriteFrame, {"__uuid__": "..."})
   3. node_set_node_property(width, 500)
   4. node_set_node_property(height, 550)
   ```
   - spriteFrame 异步加载后会自动重置节点尺寸
   - 必须最后设置 width/height

2. **组件属性名**：
   - 内部属性用下划线前缀：`_spriteFrame`、`_N$spriteFrame`（旧版）
   - 常用属性可直接用：`string`、`fontSize`、`color`、`enabled`

3. **组件类名前缀**：
   - Cocos 2.x 中部分组件类名**不带 `cc.` 前缀**
   - 如 `Button` 而非 `cc.Button`
   - 使用 `component_get_components` 先确认实际组件类型名

4. **自定义脚本组件**：
   - `scriptName` 不含扩展名（如 "PlayerController" 对应 PlayerController.js）
   - 如果项目中有同名脚本，建议使用 `scriptPath` 明确指定

---

## 四、预制体操作 (prefab)

### 可用工具

| 工具 | 描述 | 参数 |
|------|------|------|
| `prefab_get_prefab_list` | 获取预制体列表 | `folder` |
| `prefab_load_prefab` | 加载预制体到内存 | `prefabUuid` |
| `prefab_get_prefab_info` | 获取预制体信息 | `prefabUuid` |
| `prefab_validate_prefab` | 验证预制体文件格式 | `prefabUuid` |
| `prefab_instantiate_prefab` | 实例化预制体到场景 | `prefabUuid`, `parentPath`, `position` |
| `prefab_create_prefab` | 从场景节点创建新预制体 | `nodeUuid`, `prefabPath`, `prefabName` |
| `prefab_update_prefab` | 用场景节点更新预制体 | `nodeUuid`, `prefabUuid` |
| `prefab_revert_prefab` | 将预制体实例恢复到原始状态 | `nodeUuid` |
| `prefab_restore_prefab_node` | 用预制体资源恢复节点 | `nodeUuid`, `assetUuid` |
| `prefab_duplicate_prefab` | 复制预制体 | `sourcePrefabUuid`, `targetPrefabPath` |

### 使用示例

**基础预制体操作：**
```bash
# 获取预制体列表
prefab_get_prefab_list  {"folder": "db://assets"}

# 加载预制体到内存
prefab_load_prefab  {"prefabUuid": "<UUID>"}

# 获取预制体信息
prefab_get_prefab_info  {"prefabUuid": "<UUID>"}

# 验证预制体文件格式
prefab_validate_prefab  {"prefabUuid": "<UUID>"}
```

**实例化预制体：**
```bash
# 在场景中实例化预制体
prefab_instantiate_prefab  {"prefabUuid": "<UUID>", "parentPath": "Canvas"}

# 实例化时指定位置
prefab_instantiate_prefab  {"prefabUuid": "<UUID>", "parentPath": "Canvas", "position": {"x": 100, "y": 200}}
```

**创建和更新预制体：**
```bash
# 从场景节点创建新预制体
prefab_create_prefab  {"nodeUuid": "<NODE_UUID>", "prefabPath": "db://assets/prefabs/MyPrefab.prefab"}
prefab_create_prefab  {"nodeUuid": "<NODE_UUID>", "prefabPath": "db://assets/prefabs/MyPrefab.prefab", "prefabName": "MyPrefab"}

# 从场景节点更新现有预制体
prefab_update_prefab  {"nodeUuid": "<NODE_UUID>", "prefabUuid": "<PREFAB_UUID>"}

# 将预制体实例恢复到原始状态
prefab_revert_prefab  {"nodeUuid": "<NODE_UUID>"}

# 使用预制体资源恢复节点（内置撤销记录）
prefab_restore_prefab_node  {"nodeUuid": "<NODE_UUID>", "assetUuid": "<ASSET_UUID>"}
```

**复制预制体：**
```bash
# 复制现有预制体
prefab_duplicate_prefab  {"sourcePrefabUuid": "<SOURCE_UUID>", "targetPrefabPath": "db://assets/prefabs/Copy.prefab"}
```

### ⚠️ 重要注意事项

1. **预制体工作流**：
   - **创建**: node_create_node → 添加组件 → prefab_create_prefab
   - **使用**: prefab_load_prefab（可选）→ prefab_instantiate_prefab
   - **修改**: 修改实例 → prefab_update_prefab
   - **恢复**: prefab_revert_prefab

2. **部分支持的功能**：
   - `prefab_revert_prefab` 在某些 Cocos Creator 版本可能不支持

---

## 五、项目操作 (project)

### 可用工具

| 工具 | 描述 | 参数 |
|------|------|------|
| `project_get_project_info` | 获取项目信息 | 无 |
| `project_get_assets` | 按类型/路径查询资源 | `type`, `path`, `limit`, `offset`, `countOnly` |
| `project_get_asset_info` | 通过UUID获取资源信息 | `uuid` |
| `project_query_asset_uuid` | 通过URL查询资源UUID | `url` |
| `project_refresh_assets` | 刷新资源数据库 | `folder` |
| `project_create_asset` | 创建资源文件 | `url`, `content` |
| `project_delete_asset` | 删除资源 | `url` |

### 使用示例

**获取项目信息：**
```bash
# 获取项目信息（编辑器版本、项目路径、内存使用等）
project_get_project_info  {}
```

**查询资源（支持分页和路径过滤）：**
```bash
# 按类型查询（type: all, scene, prefab, script, texture, audio, animation）
project_get_assets  {"type": "texture"}

# 仅获取总数（快速模式）
project_get_assets  {"type": "texture", "countOnly": true}

# 分页查询（默认返回100条，最大1000条）
project_get_assets  {"type": "prefab", "limit": 50, "offset": 0}

# 按路径模式查询（支持通配符）
project_get_assets  {"path": "db://assets/res/hall/**/*.png"}

# 组合使用：类型 + 路径 + 分页
project_get_assets  {"type": "texture", "path": "db://assets/**/*.png", "limit": 20, "offset": 0}

# 查询特定目录下的所有文件
project_get_assets  {"path": "db://assets/res/hall/common/match_dialog/texture/**/*.*"}
```

**资源详情操作：**
```bash
# 通过UUID获取资源信息
project_get_asset_info  {"uuid": "<UUID>"}

# 通过URL查询资源UUID
project_query_asset_uuid  {"url": "db://assets/Texture/HelloWorld.png"}
```

**资源管理操作：**
```bash
# 刷新资源数据库（较慢，约30秒）
project_refresh_assets  {"folder": "db://assets"}

# 创建资源文件
project_create_asset  {"url": "db://assets/scripts/NewScript.js", "content": "// script content"}

# 删除资源
project_delete_asset  {"url": "db://assets/old.fire"}
```

### ⚠️ 重要注意事项

1. **性能优化**（2024-06-03 更新）：
   - 默认只返回 100 条结果（可通过 `limit` 调整，最大 1000）
   - 使用 `countOnly: true` 快速获取总数（30秒 → <1秒，**30倍提升**）
   - 大量资源时建议使用分页（`limit` + `offset`）

2. **路径过滤模式**：
   - 支持 `**/*.png` 递归匹配所有PNG文件
   - 支持 `texture/**/*.png` 特定目录下递归
   - 支持 `*.*` 匹配所有文件
   - 查询骨骼动画：`db://assets/**/texture/**/*.json`

3. **时序问题**：
   - 创建文件后立即查询UUID可能失败
   - 这是资源数据库更新延迟，属正常行为
   - 等待几秒后再次查询即可成功

4. **响应时间**：
   - `countOnly`: <1秒
   - 分页查询（limit ≤ 100）: <1秒
   - `refresh_assets`: ~30秒（正常，需扫描整个资源库）

---

## 六、调试工具 (debug)

### 可用工具

| 工具 | 描述 | 参数 |
|------|------|------|
| `debug_execute_script` | 在场景上下文中执行JavaScript | `script` |
| `debug_get_editor_info` | 获取编辑器和环境信息 | 无 |
| `debug_get_project_logs` | 获取项目日志文件内容 | `lines`, `filterKeyword` |
| `debug_get_console_logs` | 获取场景控制台日志 | `limit` |

### 使用示例

**执行脚本：**
```bash
# ✅ 正确：直接使用表达式
debug_execute_script  {"script": "cc.director.getScene().name"}

# ✅ 正确：使用变量
debug_execute_script  {"script": "var scene = cc.director.getScene(); scene.childrenCount"}

# ✅ 正确：生成日志
debug_execute_script  {"script": "cc.log('Test message from MCP')"}

# ❌ 错误：不支持 return 语句
# debug_execute_script  {"script": "return cc.director.getScene().name"}
```

**获取信息：**
```bash
# 获取编辑器信息（版本、内存、项目路径等）
debug_get_editor_info  {}

# 获取项目日志（从末尾读取指定行数）
debug_get_project_logs  {"lines": 50, "filterKeyword": "error"}

# 获取场景控制台日志（拦截的cc.log/warn/error）
debug_get_console_logs  {"limit": 30}
```

### ⚠️ 重要注意事项

1. **execute_script 使用限制**：
   - ❌ **不支持** `return` 语句（语法错误）
   - ✅ 直接使用表达式：`cc.director.getScene().name`
   - ✅ 使用变量声明：`var scene = cc.director.getScene(); scene.name`

2. **get_project_logs**：
   - 需要项目有 `temp/logs/project.log` 文件
   - 如果文件不存在，返回错误信息
   - 这是预期行为，不是所有项目都有日志文件

3. **get_console_logs**：
   - 需要先在场景中生成日志（通过 `cc.log` 等）
   - 返回格式：`{timestamp, type, message}`
   - 支持 `cc.log`、`cc.warn`、`cc.error`

---

## 七、重要注意事项总结

### 1. 创建新场景的完整流程

创建的 `.fire` 文件是最小场景，不含 Canvas 和 Camera。必须手动创建：

```
1. scene_create_scene  → 创建场景文件
2. scene_close_scene   → 关闭当前场景
3. scene_open_scene    → 打开新场景
4. 等待 ~2秒让场景加载完成
5. node_create_node("Canvas")  → 创建Canvas节点
6. component_add_component("cc.Canvas")  → 给Canvas加组件
7. node_set_node_property(x=480, y=320)  → 设置Canvas居中位置
8. 创建其他子节点时使用 parentPath: "Canvas"
```

### 2. 组件属性名规范

- 内部属性用下划线前缀：`_spriteFrame`、`_N$spriteFrame`（旧版）
- 常用属性可直接用：`string`、`fontSize`、`color`、`enabled`
- 颜色值格式：`{"r": 255, "g": 0, "b": 0, "a": 255}`

### 3. 节点查找方法对比

- `node_find_nodes` - 按名称模式搜索，支持部分匹配，返回所有匹配节点
- `node_find_node_by_name` - 按精确名称查找，只返回第一个匹配项
- 可指定 `searchRoot` 限制搜索范围

### 4. UUID vs 路径

- `node_get_node_info` 和 `node_delete_node` 等支持 UUID 或路径
- 路径中含 `/` 时被当作路径解析
- 不含 `/` 时先尝试 `cc.find` 再尝试 UUID
- **推荐创建节点后保存返回的 UUID**，后续操作更可靠

### 5. Widget 组件冲突

- 节点带有 `cc.Widget` 组件时，`set_node_property` 设置的位置可能不生效
- Widget 会覆盖手动设置的位置属性
- 设置前建议移除或禁用 Widget 组件

### 6. 项目性能优化

- 默认只返回 100 条结果
- 使用 `countOnly: true` 快速获取总数
- 大量资源时使用分页（`limit` + `offset`）
- `refresh_assets` 较慢（~30秒），属正常行为

---

## 八、项目自定义组件参考

以下是 DinosaruOverseas 项目中的自定义组件，可通过 `component_get_custom_component_info` 获取详细属性。

### Framework 核心框架组件

| 组件名 | 路径 | 用途 |
|--------|------|------|
| `Button` | framework/button/Button.ts | 自定义按钮，封装点击缩放动画、颜色/精灵/缓动三种过渡模式。属性：`scale_min`, `scale_max`, `scale_start_duration`, `scale_end_duration`, `color_transition`, `sprite_transition`, `tween_transition`, `limit_delay` |
| `List` | framework/list/List.ts | 通用列表，支持水平和垂直滚动，高效的 item 复用机制 |
| `ListItem` | framework/list/ListItem.ts | 列表项基类，配合 List 使用 |
| `VListHorizontal` | framework/vlist/VListHorizontal.ts | 高性能横向虚拟列表，大数据量滚动 |
| `VListVertical` | framework/vlist/VListVertical.ts | 高性能纵向虚拟列表，大数据量滚动 |
| `ListAttach` | framework/list_attach/ListAttach.ts | 列表附加组件，支持多种滚动方向的附加视图 |
| `CountdownComp` | framework/time/Countdown.ts | 倒计时组件，显示剩余时间文本 |
| `CountdownCompProgress` | framework/time/CountdownProgress.ts | 倒计时进度条组件，可视化剩余时间 |
| `ToastUI` | framework/toast/ToastUI.ts | 提示弹出框 UI，显示临时消息 |
| `Toast` | framework/toast/Toast.ts | 提示管理器，控制 Toast 显示和消失 |
| `HoldUI` | framework/hold/HoldUI.ts | 长按 UI 组件，检测长按手势 |
| `RedDotUI` | framework/utils/RedDotUI.ts | 红点 UI 组件，显示未读/待领取提示 |
| `UILayer` | framework/ui/UILayer.ts | UI 层级管理，控制弹窗层级和遮挡 |
| `BgTexture` | framework/bg_texture/BgTexture.ts | 底纹图片裁剪，将全屏底纹裁剪到节点大小 |
| `NativeInput` | framework/input/NativeInput.ts | 原生输入框，调用系统输入法 |
| `VerticalDivider` | framework/VerticalDivider.ts | 垂直分隔线，UI 布局辅助 |
| `TextFont` | framework/text_font/TextFont.ts | 文本字体组件，统一管理字体资源 |
| `GaussianBlur` | framework/shader/scr/GaussianBlur.ts | 高斯模糊效果着色器 |
| `GaussianBlurCom` | framework/GaussianBlurCom.ts | 高斯模糊通用组件 |
| `CornerColorCtrl` | framework/CornerColorCtrl.ts | 角落颜色控制器 |
| `TransmitTouch` | framework/ClickDispatch.ts | 点击传递，将触摸事件转发到目标节点 |
| `CQRCode` | framework/components/qrcode/CQRCode.js | 二维码生成组件（继承 cc.Graphics）。属性：`string`, `backColor`, `foreColor`, `margin`, `size` |
| `GListView` | framework/components/select_entry/GListView.js | 通用列表视图（JS 组件） |
| `SelectEntryComp` | framework/select_entry/SelectEntryComp.ts | 选择条目主组件 |
| `SelectEntryItem` | framework/select_entry/SelectEntryItem.ts | 选择条目子项 |
| `DebugPanel` | framework/debug/DebugPanel.ts | 调试面板，开发期调试工具 |
| `DebugList` | framework/debugList/DebugList.ts | 调试列表，显示调试数据 |
| `ResItem` | framework/ResItem.ts | 资源项，展示单个资源（金币/钻石等） |
| `TweenLite` | framework/tween/TweenLite.ts | 轻量级缓动动画组件 |
| `AudioManager` | framework/audio/AudioManager.ts | 音频管理器，统一管理音效和背景音乐 |
| `Module` | framework/modular/Module.ts | 模块基类，功能模块化 |
| `ModuleManager` | framework/modular/ModuleManager.ts | 模块管理器，管理所有功能模块 |

### 通用 UI 组件

| 组件名 | 路径 | 用途 |
|--------|------|------|
| `Menu` | common/menu/Menu.ts | 菜单组件，通用菜单栏 |
| `PullDown` | common/pullDown/PullDown.ts | 下拉刷新组件 |
| `DropDownBox` | common/dropDownBox/DropDownBox.ts | 下拉选择框组件 |
| `Avatar` | common/texture/avatar/Avatar.ts | 头像组件，显示和裁剪玩家头像 |
| `GoodsItem` | hall/common/reward/GoodsItem.ts | 物品展示项，显示资源图标和数量 |
| `StoreItem` | hall/common/store/StoreItem.ts | 商店商品项，显示商品信息和购买按钮 |
| `ResItemComp` | common/resItem/ResItemComp.ts | 资源项组件，展示资源奖励 |
| `ShowTaskItem` | common/other/showTaskItem.ts | 任务展示项 |
| `btnUnlock` | common/other/btnUnlock.ts | 按钮解锁状态组件 |
| `VirtualContent` | common/other/VirtualContent.ts | 虚拟内容容器 |
| `AddSubNum` | common/addSubNum/AddSubNum.ts | 数值增减动画组件，显示+/-数字飘字 |

### 对话框组件

| 组件名 | 路径 | 用途 |
|--------|------|------|
| `CommonDialog` | hall/common/common_rule_dialog/CommonDialog.ts | 通用对话框基类 |
| `CommonRuleDialog` | hall/common/common_rule_dialog/CommonRuleDialog.ts | 通用规则对话框 |
| `InviteActivityDialog` | resources/hall/dialog/activity/ | 邀请活动对话框，管理邀请码、奖励展示、排行榜 |
| `CampInfoDialog` | game/dialog/camp_info_dialog/CampInfoDialog.ts | 营地信息对话框 |
| `NetworkOfflineView` | game/dialog/net_offline_view/NetworkOfflineView.ts | 网络离线提示视图 |

### 引导组件

| 组件名 | 路径 | 用途 |
|--------|------|------|
| `GuideDialogTips` | common/guide/guide/feature/GuideDialogueTips.ts | 引导对话提示 |
| `GuideNormalStepUI` | common/guide/guide/step/GuideNormalStepUI.ts | 引导普通步骤 UI |
| `GuideStepDisplayMask` | common/guide/guide/step/GuideStepDisplayMask.ts | 引导高亮遮罩 |
| `GuideStepHand` | common/guide/guide/step/GuideStepHand.ts | 引导手指动画 |
| `GuideStepMask` | common/guide/guide/step/GuideStepMask.ts | 引导遮罩 |
| `GuideStepTips` | common/guide/guide/step/GuideStepTips.ts | 引导提示文字 |

### 游戏核心组件

| 组件名 | 路径 | 用途 |
|--------|------|------|
| `FightScene` | game/scr/FightScene.ts | 战斗场景主控制器 |
| `GameViewUI` | game/GameViewUI.ts | 游戏主视图 UI |
| `FightCamp` | game/scr/FightCamp.ts | 战斗营地控制器 |
| `_PlayerNode` | game/scr/_PlayerNode.ts | 玩家节点，管理玩家数据和表现 |
| `ChargeNode` | game/scr/ChargeNode.ts | 充值/蓄力节点 |
| `GameCannonDragon` | game/scr/other_dragon/GameCannonDragon.ts | 炮龙游戏模式控制器 |
| `SkillIconEffect` | game/Main/Anim/SkillIconEffect.ts | 技能图标特效动画 |
| `DragonLoading` | game/prefab/battle/DragonLoading.ts | 龙加载进度条 |
| `GameCloud` | game/common/game_cloud/GameCloud.ts | 游戏云朵装饰 |
| `GameOverDrawCard` | game/common/game_over/GameOverDrawCard.ts | 游戏结束抽卡 |
| `DgModelBaseUI` | game/scr/dragon/model/DgModelBaseUI.ts | 龙模型基础 UI |
| `DgAnimeLayer` | game/scr/dragon/res/DgAnimeLayer.ts | 龙动画层 |

### 特殊活动组件

| 组件名 | 路径 | 用途 |
|--------|------|------|
| `LianChouKaPaiitemView` | LianChouLong/ | 连抽卡牌展示项 |
| `LuckyBubbleItemUIView` | LuckyEggSmash/ | 幸运气泡展示项 |
| `LuckyEggSmashguideItemUIView` | LuckyEggSmash/ | 幸运蛋砸蛋引导项 |
| `LuckyEggLackRankItemView` | LuckyEggSmash/ | 幸运蛋排行榜项 |
| `PropCombDiscountTipDetails` | hall/common/prop_tip_details/ | 道具组合折扣详情 |
| `RewardExplainItem` | hall/common/reward_explain_dialog/ | 奖励说明项 |

### 网络与调试组件

| 组件名 | 路径 | 用途 |
|--------|------|------|
| `WebSocketCollectData` | wss/Socket/debug/ | WebSocket 数据采集 |
| `WebSocketMonitor` | wss/Socket/debug/ | WebSocket 连接监控 |
| `AssetUpdateUI` | asset_update_anime/ | 资源热更新 UI |
| `DebugTest` | common/debug/ | 调试测试工具 |

### 组件查询示例

```bash
# 1. 找到节点
node_find_node_by_name  {"name": "InviteActivityDialog"}

# 2. 获取自定义组件完整属性
component_get_custom_component_info  {"nodeUuid": "<UUID>", "componentType": "InviteActivityDialog"}

# 3. 获取自定义 Button 的动画配置
component_get_custom_component_info  {"nodeUuid": "<UUID>", "componentType": "Button"}

# 返回：scale_min, scale_max, scale_start_duration, scale_end_duration, color_transition 等
```

### 查询内建 cc.Button vs 自定义 Button

```bash
# 内建 cc.Button（如果存在）
component_get_button_info  {"nodeUuid": "<UUID>"}

# 自定义 Button（本项目常用）
component_get_custom_component_info  {"nodeUuid": "<UUID>", "componentType": "Button"}
```

### 组件名注意事项

- Cocos 2.x 中部分组件类名**不带 `cc.` 前缀**，如 `Button` 而非 `cc.Button`
- 使用 `component_get_custom_component_info` 时直接传组件类名即可
- 使用 `component_remove_component` 时若 `cc.Button` 匹配不到，尝试用 `Button`
- 使用 `component_get_components` 先确认节点上的实际组件类型名

---

## 九、常见问题

### Q: execute_script 报错 "Illegal return statement"？

**A:** 不支持 `return` 语句。改用直接表达式：
```bash
# ❌ 错误
debug_execute_script  {"script": "return cc.director.getScene().name"}

# ✅ 正确
debug_execute_script  {"script": "cc.director.getScene().name"}
```

### Q: project_get_assets 响应很慢？

**A:** 使用 `countOnly` 或分页查询：
```bash
# 快速获取总数
project_get_assets  {"type": "texture", "countOnly": true}

# 分页查询
project_get_assets  {"type": "prefab", "limit": 50, "offset": 0}
```

### Q: 如何查询特定目录下的图片？

**A:** 使用路径模式：
```bash
project_get_assets  {"path": "db://assets/res/hall/**/*.png"}
```

### Q: 如何查询骨骼动画？

**A:** 查询 JSON 文件：
```bash
project_get_assets  {"path": "db://assets/res/hall/common/match_dialog/texture/**/*.json"}
```

---

## 十、性能指标

| 操作 | 响应时间 | 说明 |
|------|----------|------|
| 获取资源总数（优化后） | <1秒 | 使用 `countOnly: true` |
| 分页查询（≤100条） | <1秒 | 默认 limit=100 |
| 刷新资源数据库 | ~30秒 | 需扫描整个资源库 |
| 创建资源文件 | <1秒 | 文件创建完成后立即返回 |
| 删除资源文件 | <1秒 | 使用 fs.unlink 优化 |
| 场景操作 | 1-2秒 | 需等待场景加载 |

---

## 十一、UAT2 环境构建

在项目目录下执行构建脚本即可：

```bash
cd "D:/Users/PC/Desktop/heyafeng/game/DinosaruOverseas"
bash build-uat2.sh
```

---

**最后更新**: 2024-06-04
**测试覆盖率**: 100% (57/57 可测试工具)
**Cocos Creator 版本**: 2.4.7+
**服务器端口**: 8585
