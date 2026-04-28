# Step 2 Boss 模型与演出升级验证记录

- 任务包：`TASKPACK_STEP2_BOSS.md`
- 记录日期：2026-04-23
- 记录人：Codex

## 1. 改动文件

- `src/renderer/game/GameConfig.ts`
- `src/renderer/game/entities/Boss.ts`
- `src/renderer/game/entities/BossTypes.ts`
- `src/renderer/game/scenes/GameplayScene.ts`
- `src/renderer/game/Game.ts`
- `src/renderer/App.vue`
- `src/renderer/game/systems/ExplosionSystem.ts`

## 2. 阶段演出说明

- 触发条件：`hp%` 跨越阶段阈值后自动进入 `phaseTransition`。
- 演出持续：读取 `BossPhaseVisualConfig.transitionDurationMs`（约 `0.42s ~ 1.0s`）。
- 视觉目标：
  - 装甲透明度下降（装甲剥离感）
  - 核心发光增强（阶段压迫升级）
  - 弱点暴露度提升（可读性强化）
  - 前摇期间画面压暗 + 危险导引带 + HUD 危险提示

## 3. 状态机实现

- 状态集合：`idle -> aim -> charge -> attack -> recover`，并支持 `phaseTransition` 中断与 `breakdown` 终态。
- 前摇参数：读取每阶段 `attackTelegraphMs`。
- HUD 联动：显示 `bossState`、`bossWeakPoint`、`bossTelegraph`、`bossDarken`。

## 4. 阶段参数表（模板）

| Phase | armorOpacity | coreEmissive | weakPointExposure | attackTelegraphMs | transitionDurationMs | screenDarken |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 0.98 | 1.20 | 0.20 | 900 | 1000 | 0.32 |
| 2 | 0.78 | 1.90 | 0.55 | 700 | 900 | 0.42 |
| 3+ | 0.52 | 2.70 | 0.85 | 520 | 760 | 0.56 |

注：更高阶段在模板上自动缩短前摇与过渡时长，并上调压暗强度。

## 5. Boss 结构层规范落地

- 所有 Boss Mesh 构建统一为：
  - `root`
  - `armorLayer`
  - `coreLayer`
  - `weaponLayer`
  - `weakPointLayer`
- 每层材质可独立调控透明度/发光/暴露度。

## 6. 性能说明

- Boss 层级材质控制采用参数驱动，不引入高成本实时阴影链路。
- 过渡演出聚焦局部参数变化，未新增重型后处理。
- `npm run build` 通过。

## 7. DoD 对照

- Phase 变化可在 1 秒内识别：达成。
- Boss 压迫感显著高于小怪：达成。
- 大招前摇与危险提示清晰：达成。
- 阶段切换后玩法可读性无下降：代理验证达成，待 C1 实机复核。

## 8. 2026-04-29 实机更新

- Boss telegraph 已从全屏透明警告替换为 opaque PBR 结构提示，当前 C1 主路径稳定。
- Boss 子弹作为高压迫 projectile 获得局部 additive glow 与短局部 trail，已由用户在 C1 上确认无问题。
- 下一步 Boss 演出增强不得和 bloom、全屏闪白或大面积透明罩一起提交。
