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

# 按名称模式搜索节点（支持部分匹配）
node_find_nodes  {"pattern": "Camera", "exactMatch": false}

# 按精确名称查找单个节点（返回第一个匹配项）
node_find_node_by_name  {"name": "Main Camera"}
node_find_node_by_name  {"name": "Button", "searchRoot": "Canvas"}

# 获取场景中所有节点
node_get_all_nodes
```

### 修改节点属性
```bash
# 支持的属性：name, active, x, y, scaleX, scaleY, rotation, width, height, anchorX, anchorY
node_set_node_property  {"uuid": "<UUID>", "property": "width", "value": 500}
node_set_node_property  {"uuid": "<UUID>", "property": "x", "value": 100}
```

### 其他节点操作
```bash
# 删除节点
node_delete_node  {"uuid": "<UUID>"}

# 移动节点到新父节点
node_move_node  {"nodeUuid": "<UUID>", "newParentUuid": "<PARENT_UUID>"}

# 移动节点到新父节点并指定位置
node_move_node  {"nodeUuid": "<UUID>", "newParentUuid": "<PARENT_UUID>", "siblingIndex": 0}

# 复制节点
node_duplicate_node  {"uuid": "<UUID>"}
```

---

## 三、组件操作 (component)

### 添加/移除组件
```bash
# 添加内置组件（常用类型：cc.Sprite, cc.Label, cc.Button, cc.Camera, cc.Canvas, cc.Widget, cc.AudioSource, cc.Layout, cc.Animation 等）
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

### 获取组件详细信息
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

### 设置组件属性
```bash
# 通用属性设置
component_set_component_property  {"nodeUuid": "<UUID>", "componentType": "cc.Label", "property": "string", "value": "Hello"}
component_set_component_property  {"nodeUuid": "<UUID>", "componentType": "cc.Label", "property": "fontSize", "value": 32}
```

---

## 四、预制体操作 (prefab)

### 基础预制体操作
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

### 实例化预制体
```bash
# 在场景中实例化预制体
prefab_instantiate_prefab  {"prefabUuid": "<UUID>", "parentPath": "Canvas"}

# 实例化时指定位置
prefab_instantiate_prefab  {"prefabUuid": "<UUID>", "parentPath": "Canvas", "position": {"x": 100, "y": 200}}
```

### 创建和更新预制体
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

### 复制预制体
```bash
# 复制现有预制体
prefab_duplicate_prefab  {"sourcePrefabUuid": "<SOURCE_UUID>", "targetPrefabPath": "db://assets/prefabs/Copy.prefab"}
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
project_create_asset  {"url": "db://assets/scripts/NewScript.js", "content": "// script content"}

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

# 获取项目日志（从末尾读取指定行数）
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

### 3. 自定义脚本组件

- 使用 `component_attach_script` 附加用户定义的脚本
- `scriptName` 不含扩展名（如 "PlayerController" 对应 PlayerController.js）
- 如果项目中有同名脚本，建议使用 `scriptPath` 明确指定

```bash
# 附加自定义脚本
component_attach_script  {"nodeUuid": "<UUID>", "scriptName": "MyController", "scriptPath": "db://assets/scripts/MyController.js"}
```

### 4. 预制体工作流

**创建预制体：**
```bash
1. node_create_node → 创建节点
2. 添加组件和配置属性
3. prefab_create_prefab → 创建预制体
```

**使用预制体：**
```bash
1. prefab_load_prefab → 加载到内存（可选，实例化时会自动加载）
2. prefab_instantiate_prefab → 实例化到场景
```

**修改预制体：**
```bash
1. 修改场景中的预制体实例
2. prefab_update_prefab → 更新预制体资源
```

**恢复预制体实例：**
```bash
prefab_revert_prefab → 将实例恢复到预制体原始状态
```

### 5. 保存场景

- 使用 `scene_save_scene` 保存，**不会弹出文件对话框**
- 前提：场景必须通过 `scene_open_scene` 打开（内部使用 `_Scene.loadSceneByUuid`）
- 如果保存走了 fallback 会弹出对话框，检查流程是否正确

### 6. 父节点路径

- `parentPath` 使用 `/` 分隔的节点路径，如 `"Canvas/Bg/Sprite"`
- 如果 `cc.find(parentPath)` 找不到节点，会 fallback 到场景根节点
- **确保父节点已存在**再创建子节点

### 7. 场景操作间隔

- `scene_open_scene` 后需等待约 **2秒** 让编辑器完成加载
- `scene_close_scene` 后等待约 **1秒**
- 可用 `scene_get_scene_hierarchy` 确认场景是否加载完成

### 8. UUID vs 路径

- `node_get_node_info` 和 `node_delete_node` 等接口支持 UUID 或路径（如 `"Canvas/Bg"`）
- 路径中含 `/` 时会被当作路径解析，不含 `/` 时先尝试 `cc.find` 再尝试 UUID 查找
- **推荐创建节点后保存返回的 UUID**，后续操作用 UUID 更可靠

### 9. 组件属性名

- 内部属性用下划线前缀：`_spriteFrame`、`_N$spriteFrame`（旧版）
- 常用属性可直接用：`string`、`fontSize`、`color`、`enabled`
- 颜色值格式：`{"r": 255, "g": 0, "b": 0, "a": 255}`

### 10. 节点查找方法对比

- `node_find_nodes` - 按名称模式搜索，支持部分匹配，返回所有匹配节点
- `node_find_node_by_name` - 按精确名称查找，只返回第一个匹配项
- 可指定 `searchRoot` 限制搜索范围

```bash
# 查找所有包含 "Button" 的节点
node_find_nodes  {"pattern": "Button", "exactMatch": false}

# 查找名为 "SubmitButton" 的第一个节点
node_find_node_by_name  {"name": "SubmitButton"}

# 在 Canvas 下查找名为 "Bg" 的节点
node_find_node_by_name  {"name": "Bg", "searchRoot": "Canvas"}
```

---

## 七、项目自定义组件参考

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

---

## 八、自定义组件查询示例

### 查询 InviteActivityDialog 组件的所有属性
```bash
# 1. 找到节点
node_find_node_by_name  {"name": "InviteActivityDialog"}

# 2. 获取自定义组件完整属性
component_get_custom_component_info  {"nodeUuid": "<UUID>", "componentType": "InviteActivityDialog"}
```

### 查询自定义 Button 组件的动画配置
```bash
# 获取自定义 Button 的缩放和颜色配置
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
