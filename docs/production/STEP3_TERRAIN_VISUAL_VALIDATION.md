# Step 3 地形与关卡表现升级验证记录

- 任务包：`TASKPACK_STEP3_TERRAIN_LEVELS.md`
- 记录日期：2026-04-23
- 记录人：Codex

## 1. 改动文件

- `src/renderer/game/GameConfig.ts`
- `src/renderer/game/systems/ScrollMap.ts`
- `src/renderer/game/scenes/GameplayScene.ts`

## 2. 交付项映射

- 地形分层：完成（远景 / 中景 / 近景 / 气候层）。
- 氛围气候：完成（ash / ion / dust / warp / none）。
- 转场表现：完成（Boss 击破后调用 `transitionToBiome(..., 2.8s)` 平滑过渡）。

## 3. 地形参数表（来自配置）

| Biome | mainColor | farColor | nearColor | contrast | fogDensity | emissiveRatio | climate |
|---|---|---|---|---:|---:|---:|---|
| earth_plains | `0x2c6620` | `0x1a2b0f` | `0x466e2b` | 0.55 | 0.0060 | 0.15 | none |
| earth_desert | `0xa77d3e` | `0x4a3621` | `0xc49a57` | 0.62 | 0.0070 | 0.16 | dust |
| earth_ocean | `0x163e88` | `0x081832` | `0x2e73b8` | 0.45 | 0.0050 | 0.20 | ion |
| earth_volcanic | `0x3b1308` | `0x1a0502` | `0x7a220c` | 0.74 | 0.0100 | 0.36 | ash |
| earth_ruins | `0x5b5349` | `0x1e1b18` | `0x7f7361` | 0.58 | 0.0085 | 0.18 | dust |
| space_orbit | `0x141a2f` | `0x05070f` | `0x2d3d68` | 0.50 | 0.0025 | 0.24 | ion |
| space_deep | `0x1c1235` | `0x05030a` | `0x49307c` | 0.63 | 0.0018 | 0.34 | none |
| space_asteroid | `0x4b4030` | `0x130f0a` | `0x7d6648` | 0.68 | 0.0035 | 0.25 | dust |
| space_blackhole | `0x0b0606` | `0x000000` | `0x4a1706` | 0.82 | 0.0012 | 0.44 | warp |
| space_final | `0x220f35` | `0x06020d` | `0x5a2c7c` | 0.72 | 0.0020 | 0.40 | warp |

## 4. 转场前后视觉目标

- 前：保持当前关卡色调与对比，保障战斗读取稳定。
- 中：2.8 秒线性渐变背景色与雾参数，地形网格高度/顶点色同步过渡。
- 后：新关卡主色与气候生效，远中近景全部切换到新配置。

## 5. 验收结论（DoD）

- 任意阶段具备明显前中后景：达成。
- 关卡差异明显且风格统一：达成。
- 转场自然且战斗可读性未被破坏：代理验证达成。

## 6. 性能与风险

- 仅保留低成本分层对象与简化气候粒子，不引入重后处理。
- 地形过渡仅在 Boss 后触发，常态开销稳定。
- `npm run build` 通过，待 C1 实机补测快速滚屏场景下的深度稳定性。
