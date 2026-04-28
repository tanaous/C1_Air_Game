# Step 1B 敌机与基础战斗视觉统一验证记录

- 任务包：`TASKPACK_STEP1_PLAYER_ENEMIES.md`
- 覆盖任务卡：`VE-01 ~ VE-05`
- 记录日期：2026-04-23
- 记录人：Codex

## 1. 改动文件

- `src/renderer/game/entities/Enemy.ts`
- `src/renderer/game/systems/CollisionSystem.ts`
- `src/renderer/game/systems/ExplosionSystem.ts`
- `src/renderer/game/scenes/GameplayScene.ts`

## 2. 结构差异（旧 vs 新）

- 敌机模型：从“几何体换色”提升为每类型独立轮廓方案（scout/fighter/swooper/gunship/bomber/carrier）。
- 敌机材质：从 `MeshPhongMaterial` 统一迁移到 `MeshStandardMaterial` / `MeshPhysicalMaterial`。
- 战斗反馈：新增出场高亮、受击闪烁、低血量临界脉冲、命中火花与击毁爆裂节奏分离。

## 3. 关键参数

- 出场高亮时长：`0.42s`
- 受击闪烁时长：`0.16s`
- 低血量阈值：`HP < 35%`
- 敌机层级深度偏移：按机型设置 `depthBias`（约 `-0.10 ~ -0.30`）

## 4. 验收映射

- `VE-01` 轮廓升级：完成。六类敌机在远距可通过轮廓区分。
- `VE-02` 材质统一：完成。建立统一敌方材质工厂与阵营发光逻辑。
- `VE-03` 命中反馈：完成。新增命中火花与受击状态驱动。
- `VE-04` 击毁表现：完成。小怪击毁爆裂节奏改为“短时冲击 + 快速衰减”。
- `VE-05` 对比校准：完成。敌机亮度与深度层级限制，主角机仍为主视觉焦点。

## 5. 性能影响

- 敌机材质升级与特效分层后，构建与运行未出现阻塞性回退。
- 粒子数量按敌机规模分级，峰值可控。
- `npm run build` 通过。

## 6. C1 代理观察结论

- 敌我颜色、轮廓、深度分层更明确。
- 高频特效仍集中在局部，不会形成全屏泛亮污染。
- 需实机补测项：高密度弹幕 + 多机型同屏时的串扰边界。

## 7. 2026-04-29 实机更新

- 非 Boss 敌人、基础实体弹幕、命中/击毁/出场反馈已在当前 C1-safe 主路径中多轮确认稳定。
- 普通敌弹保持实体 faceted projectile；透明拖尾尚未扩展到普通敌弹。
- 已验证的透明边界仅包括玩家/Boss 子弹局部 glow 与短局部 trail。
