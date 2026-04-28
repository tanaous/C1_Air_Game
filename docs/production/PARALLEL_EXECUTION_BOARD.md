# 并行执行看板

## 0. 2026-04-29 当前状态

- 当前主线已从早期“玩家机优先”切换为“C1 效果恢复优先”。
- C1 显示链路、全屏输出、在线设备参数、普通屏 debug 窗口、相机导演、实体 PBR 效果层、C1-safe HUD、局部 additive glow、短局部拖尾均已通过实机确认。
- 当前任务卡：[TASKPACK_STEP4_C1_EFFECT_RESTORE.md](E:\AI\C1_Air_Game\C1_Air_Game\docs\production\TASKPACK_STEP4_C1_EFFECT_RESTORE.md)
- 明日继续时优先选择一个新的效果机制做小步恢复；机制变化后停下等待 C1 实机确认。
- 背景 biome 美术重设计已记录为后续增强，不混入当前效果恢复提交。

## 1. 总原则

- 不按天拆任务。
- 按“关键路径 + 可并行支线”组织代理执行。
- 关键路径优先保证主角飞船方案落地。
- 并行任务不得同时重写同一核心文件。

## 2. 当前关键路径

### Critical Path

1. 保持已验证 C1 renderer 和设备参数不变
2. 按渲染机制风险分级恢复效果层
3. 每引入一种新的透明或后处理机制就停下做 C1 实机确认
4. 效果恢复到完整画面形态后，再回到玩法系统和最终美术深化

当前关键路径文档：

- [08_C1_CONTENT_MODELING_GUIDE.md](E:\AI\C1_Air_Game\C1_Air_Game\docs\08_C1_CONTENT_MODELING_GUIDE.md)
- [TASKPACK_STEP4_C1_EFFECT_RESTORE.md](E:\AI\C1_Air_Game\C1_Air_Game\docs\production\TASKPACK_STEP4_C1_EFFECT_RESTORE.md)

## 3. 可并行轨道

### 轨道 A：主角飞船实现

- 负责文件：`Player.ts`、玩家机子模块、相关材质与 shader
- 状态：已进入 C1-safe 实体效果恢复路线，后续只做不破坏已验证机制的深化

### 轨道 B：参考与参数基线整理

- 负责文件：`docs/` 下方案文档、参数表、参考链接
- 状态：持续维护；以 C1 实机验证记录为准

### 轨道 C：敌机升级预案

- 负责文件：`Enemy.ts` 设计草案、敌机材质参数预设
- 状态：实体 PBR 方向已恢复，透明拖尾仍不得扩展到普通敌弹

### 轨道 D：后处理与显示验证原型

- 负责文件：`rendering/` 下实验模块
- 状态：高风险；禁止直接启用 bloom/blur/post，必须独立检查点验证

## 4. 合并规则

- 玩家飞船核心结构完成前，不合并依赖其视觉标准的敌机成品。
- 任何模糊型后处理实验都不得直接覆盖正式交织输出。
- 如果轨道 A 改了材质接口，轨道 C 必须跟随更新，不得保留旧接口分叉。

## 5. 每次提交必须包含

- 改动文件边界
- 影响的任务卡编号
- 是否影响性能
- 是否影响 C1 深度与交织稳定性
