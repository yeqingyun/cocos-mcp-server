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
| Screenshot | 1 | ✅ | 场景截图（Camera 渲染为 PNG 内联返回） |
| **总计** | **61** | **✅ 100%** | **测试覆盖率100%** |

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

4. **⚠️ `scene_save_scene` 会清空 sp.Skeleton 的 skeletonData（实测 Bug）**：
   - 通过 MCP 保存场景时，`sp.Skeleton` 组件的 `_N$skeletonData` 字段会被重置为 `{}`（即绑定丢失）。
   - **cc.Sprite 的 `_spriteFrame` 不受影响，能正常持久化**；只有 spine 数据有这个问题。
   - 结论：**spine 数据不要指望通过 MCP 流程静态绑定并保存**，应改用脚本运行时加载（见第十二章避坑指南）。

5. **⚠️ 避免反复 close → 改 .fire 文件 → open → save 的循环**：
   - MCP 的 `scene_save_scene` 序列化路径与编辑器原生保存不完全一致，execute_script 创建的运行时节点在**首次保存**能持久化，但在多次 close/open/save 往复后，**有可能把整个场景文件截断**（实测曾把含 32 节点的场景覆盖成只剩 Canvas + Camera）。
   - **正确做法**：execute_script 建完树 + 设完属性后，**只 save 一次**，之后尽量在编辑器 UI 里手动保存，不要再做 close/open 循环。

6. **节点 UUID 在 close/open/save 后会变化**：
   - 每次重新打开或保存场景，节点的运行时 UUID 可能重新生成。
   - **缓存过的 UUID 在场景重载后必然失效**（报 "Node not found"）。
   - 正确做法：每次场景重载后，用 `node_find_node_by_name` 或 `debug_execute_script` + `cc.find(...).uuid` **重新拉取 UUID** 再操作。

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

5. **⚠️ cc.Label 不能和 cc.Sprite 共存于同一节点（渲染组件冲突）**：
   - 报错：`Can't add component 'cc.Label' to xxx because it conflicts with the existing 'cc.Sprite' derived component.`
   - 一个节点只能挂**一个渲染类组件**（Sprite / Label / RichText / Graphics 等互斥）。
   - **正确做法**：给按钮/图片节点加文字，要**新建一个子节点**挂 Label，不要直接往带 Sprite 的节点上 addComponent(cc.Label)。
   - 例：`btn_buy`（已有 cc.Sprite + cc.Button）→ 新建子节点 `txt_buy` 挂 cc.Label。

6. **⚠️ sp.Skeleton 的 skeletonData 通过 MCP 绑定不可靠**：
   - 属性名是 `_N$skeletonData`（**不是** `_skeletonData`，也不是公开的 `skeletonData`）。
   - 用 `component_set_component_property` 设 `_N$skeletonData` + `{"__uuid__":"..."}`：**返回 success 但保存后变 `{}`**（不持久化）。
   - 直接改 .fire 文件注入 uuid：运行时能加载（HAS_DATA），但编辑器属性系统不认 → **Inspector 打不开**，报 `this.skeletonData.getSkinsEnum is not a function` / `getAnimsEnum is not a function`。
   - 用公开属性 `skeletonData` 设值：setter 调 `getAnimsEnum` 直接抛异常，**会把组件弄成损坏态**，之后 Inspector 一直崩。
   - **正确做法**：spine 数据留空，在脚本里运行时 `res.load` 加载并赋值；或重启编辑器后用 Inspector 手动拖入。

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

2. **✅ 新建预制体 = 新建一个场景当工作区（关键认知）**：
   - MCP 没有独立的预制体编辑模式，**编辑预制体的内容必须在场景里进行**。所以「新建预制体」的实际流程是：`scene_create_scene` 建一个空场景 → 在里面搭节点树 → `prefab_create_prefab` 把树存成 `.prefab`。
   - **预制体内容不需要、也不应保留 Canvas 和 Main Camera 节点**。这两个是场景级基础设施，预制体只装真正的 UI 子树（如弹窗根节点、列表项根节点）。
   - 推荐流程：
     ```
     1. scene_create_scene（建临时场景）→ scene_close_scene → scene_open_scene
     2. 直接建预制体根节点（例如叫 MyDialog），不要建 Canvas/Main Camera
        - 可用 debug_execute_script：var root = new cc.Node('MyDialog'); root.parent = cc.director.getScene();
     3. 在 root 下搭完整 UI 子树 + 挂组件
     4. 设 spriteFrame / Label 等属性
     5. prefab_create_prefab({"nodeUuid": <root的uuid>, "prefabPath": "db://assets/xxx/MyDialog.prefab"})
     6. scene_save_scene 保存一次
     ```
   - 这样产出的 `.prefab` 文件干净，实例化时由调用方挂到任意 Canvas 下，不会带多余的 Canvas/Main Camera。

3. **部分支持的功能**：
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

2. **✅ execute_script 是批量建树的推荐方式（实测高效可靠）**：
   - 用 `new cc.Node()` + `node.parent = ...` + `addComponent(cc.Sprite)` 一次性建整棵节点树，比逐个 `node_create_node` 快几十倍。
   - **创建的节点能持久化**：建完后调一次 `scene_save_scene`，节点会写入 .fire 文件（实测 32 节点 + 组件全部保存成功）。
   - `addComponent(cc.Label)` 后**立即**给 `.string` 赋值即可；脚本最后用一行表达式返回统计结果（如 `'nodes=' + root.childrenCount`）。
   - **注意**：execute_script 是在**运行时场景上下文**执行，无法访问 `Editor` 主进程 API；要设资源引用（spriteFrame）建议用 `component_set_component_property` 走编辑器属性管道，序列化更可靠。
   - **注意**：execute_script 内 `addComponent(cc.Label)` 到已有 cc.Sprite 的节点会返回 `null`（渲染组件冲突，见组件章第 5 条），脚本会中止 —— 建子节点挂 Label。

3. **get_project_logs**：
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

### Q: sp.Skeleton 节点的属性编辑器（Inspector）打不开，报 `this.skeletonData.getSkinsEnum is not a function`？

**A:** 这是 spine 数据绑定异常导致的，根因和解法见 **第十二章**。简要：
- 该组件的 skeletonData 处于损坏/未正确解析态（常见于用 MCP 设过 spine 数据、或直接改过 .fire 注入 uuid）。
- **应急修复**：`component_remove_component` 移除该 sp.Skeleton → `component_add_component` 重新加一个空 sp.Skeleton → Inspector 即可打开。
- **根治**：spine 数据不要用 MCP 静态绑定，改为脚本运行时 `res.load` 加载；或重启编辑器后用 Inspector 手动拖入 spine 资源。

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

## 十二、实测最佳实践与避坑（实战总结）

> 本节由真实搭建测试场景（testStore.fire，含 32 节点 / 9 张图片 / spine / 自定义脚本）验证得出，**优先级最高，遇到对应场景务必遵守**。

### ✅ 正确做法 vs ❌ 避免做法

| 场景 | ✅ 正确做法 | ❌ 避免做法（会踩坑） |
|------|------------|----------------------|
| **批量建节点树** | `debug_execute_script` 用 `new cc.Node()` + `addComponent()` 一次性建完，再 `scene_save_scene` **保存一次** | 逐个调 `node_create_node`（几十次调用，极慢） |
| **设图片 spriteFrame** | `component_set_component_property` 设 `_spriteFrame` = `{"__uuid__":"..."}`，可正常持久化 | 用 execute_script 的 `cc.loader.load` 在编辑器里加载（会报 download failed） |
| **spine skeletonData** | 组件留空，**脚本运行时** `res.load` 加载并赋值；或重启编辑器后 Inspector 手动拖 | 用 MCP 设 `_N$skeletonData`（保存后丢失）；直接改 .fire 注入 uuid（Inspector 崩 `getSkinsEnum is not a function`）；设公开 `skeletonData`（损坏组件） |
| **给按钮加文字** | 新建**子节点**挂 cc.Label（如 `btn_buy/txt_buy`） | 往带 cc.Sprite 的节点 `addComponent(cc.Label)`（渲染组件冲突，返回 null 中止脚本） |
| **保存场景** | 建树+设属性后 `scene_save_scene` **一次**；之后在编辑器 UI 手动保存 | 反复 close → 改 .fire → open → save 循环（**可能截断整个场景文件**，丢失全部节点） |
| **节点 UUID** | 每次场景 close/open/save 后，用 `node_find_node_by_name` 或 execute_script 重新取 UUID | 缓存 UUID 跨场景重载使用（必然 "Node not found"） |
| **资源 UUID 获取** | 读 .png.meta 里 `subMetas.<name>.uuid`（sprite-frame 子资源 uuid），批量可用 `grep -B1 '"importer": "sprite-frame"'` | 用 `project_query_asset_uuid`（返回的是 texture 主 uuid，设给 `_spriteFrame` 不生效） |
| **新建预制体** | **新建一个临时场景当工作区**，里面只搭 UI 子树（**不含 Canvas / Main Camera**），再 `prefab_create_prefab` 存成 .prefab | 在带 Canvas/Main Camera 的场景里直接 `prefab_create_prefab`（会把场景级基础设施也打进预制体，实例化时多一层/冲突） |

### 关键原理

1. **sprite-frame vs texture 的 uuid**：Cocos 2.x 的 `.png` 导出后，.meta 里有**两个** uuid —— 顶层 texture uuid 和 `subMetas` 里的 sprite-frame uuid。设 `_spriteFrame` 必须用 **sprite-frame 子资源 uuid**，不是 texture 主 uuid。
2. **spine 序列化字段名**：`sp.Skeleton` 的可序列化字段是 `_N$skeletonData`（带 `_N$` 前缀），不是 `_skeletonData`，也不是公开 getter `skeletonData`。但即便用对了字段名，MCP 保存路径仍会清空它 —— 这是 MCP 与编辑器 spine 序列化的兼容缺陷。
3. **execute_script 节点持久化条件**：运行时 `new cc.Node()` 创建的节点，在**首次** `scene_save_scene` 时会被序列化进 .fire；但编辑器对这类"非编辑器原生创建"节点的所有权是脆弱的，经过 close/open 后再 save 有丢失风险。
4. **Inspector 崩溃根因**：sp.Skeleton 的 Inspector 会调 `skeletonData.getSkinsEnum()/getAnimsEnum()` 画下拉框；当 skeletonData 不是带这些编辑器方法的 `sp.SkeletonData` 实例时（uuid 注入未走编辑器属性管道、或 setter 中途崩溃留下损坏态），Inspector 直接打不开。

### 推荐的"搭建一个含图片+spine+脚本的场景"完整流程

```
1. scene_create_scene → scene_close_scene → scene_open_scene（等 2~5s）
2. debug_execute_script：建 Canvas + 整棵节点树（new cc.Node + addComponent + 设尺寸/位置/Label.string），结尾返回统计
3. scene_save_scene  保存一次，确认 .fire 文件 node 数量正确（grep cc.Node 计数）
4. execute_script 取所有需设图片的节点 uuid（cc.find(...).uuid → JSON.stringify）
5. 批量 component_set_component_property 设 _spriteFrame（用 sprite-frame 子资源 uuid）
6. component_attach_script 挂自定义脚本组件
7. scene_save_scene  保存第二次（sprite 引用会持久化）
8. spine 数据：不静态绑定，留给脚本运行时 res.load 加载
9. 验证：scene_get_scene_hierarchy 确认树完整；component_get_component_info 确认各组件 Inspector 可打开
```

> ⚠️ 全程**不要** close/open 反复横跳；**不要**手改 .fire 后再用 MCP save。

---

## 十三、场景截图 (screenshot)

### 可用工具

| 工具 | 描述 | 参数 |
|------|------|------|
| `screenshot_capture_scene` | 用场景里的 Camera 把当前场景渲染成 PNG 截图返回 | `width`, `height`, `cameraUuid`(可选), `savePath`(可选) |

### 说明

- 把相机渲染到 RenderTexture，读像素后编码为 PNG。
- **以 MCP `image` 内容块内联返回**，调用方（如 Claude）可直接看到画面；同时可选 `savePath` 存盘。
- **捕获的是"游戏相机视角"**（Camera 组件所见），不是编辑器视口的 gizmo / 网格 / 选中高亮。
- **无需场景里有 Camera**：没传 `cameraUuid` 且场景无相机时（如预制体），自动建临时正交相机取景，截完销毁，不污染场景。分辨率默认 512×512，范围 1–2048。
- `savePath` 支持绝对路径或 `db://` 路径（如 `db://assets/screenshot.png`，落到 assets 目录后会被资源库自动导入为贴图）。

**取景规则（优先级）：**
1. 传 `cameraUuid` → 用指定相机。
2. 传 `targetNodeUuid` → 自动建临时相机，**只框该节点子树**（排除兄弟/父级）。
3. 都不传且场景有相机 → 用第一个相机。
4. 都不传且无相机 → 自动建临时相机**框整个场景**。

### 使用示例

```bash
# 默认 512x512 截图，内联返回
screenshot_capture_scene  {}

# 指定分辨率 + 相机
screenshot_capture_scene  {"width": 1024, "height": 576, "cameraUuid": "<MAIN_CAMERA_UUID>"}

# 只截某节点子树（紧框该节点，自动建临时相机）
screenshot_capture_scene  {"targetNodeUuid": "<NODE_UUID>", "width": 300, "height": 300}

# 截图并存盘
screenshot_capture_scene  {"savePath": "db://assets/snapshots/scene-001.png"}
```

### ⚠️ 注意事项

1. **无需 Camera**：没相机时（如预制体）会自动建临时正交相机取景；想换角度需传 `cameraUuid` 指定相机或先改相机。
2. **只截某子树**：传 `targetNodeUuid` 可紧框指定节点（排除兄弟/父级），适合给单个 UI 元素出图。
3. **视角≠编辑器视口**：截到的是相机取景，不含编辑器 gizmo/网格/选中高亮。
4. **临时改动**：自动建的临时相机会在截完后销毁，不污染场景；指定相机时仅临时改 `targetTexture` 并恢复。
5. **数据量**：大分辨率（如 2048×2048）返回的 base64 较大、较慢，日常用 512–1024 即可。
6. **版本**：该工具面向 **Cocos Creator 2.4.7**（`cc.RenderTexture.initWithSize` + `camera.render()` + `readPixels()`，引擎通过全局 `cc` 访问）；同时保留 3.x 的 `reset`/`pipeline.render` 作为自动回退。

---

**最后更新**: 2026-07-08
**测试覆盖率**: 100% (57/57 可测试工具)
**Cocos Creator 版本**: 2.4.7+
**服务器端口**: 8585
