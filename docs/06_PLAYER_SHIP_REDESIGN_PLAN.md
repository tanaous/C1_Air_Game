# 主角飞船重设计方案

## 1. 背景

当前主角飞船已经具备基本玩法功能，但三维表现仍停留在占位阶段。对于普通 2D 屏幕，这个问题只是“不够精致”；对于 CubeVi C1 裸眼 3D 屏幕，这会被放大成“体积不足、边缘单薄、层次贫乏、主角不够像主角”。

因此，主角飞船必须先于其他视觉升级项被彻底重做。

## 2. 当前问题归纳

### 2.1 造型问题

- 机体结构过于简单。
- 主轮廓缺少记忆点。
- 翼面和主舱厚度不足。
- 武装、座舱、推进器没有形成明确层级。

### 2.2 材质问题

- 当前主要依赖 `MeshPhongMaterial`。
- 高光表达单一，缺少真实表面层次。
- 不同部件的材质差异不足。

### 2.3 灯光问题

- 当前是全场通用布光，不是主角专属布光。
- 缺少强化轮廓的边缘光。
- 缺少配合 PBR 的环境反射。

### 2.4 C1 适配问题

- 过薄结构在多视角下容易虚。
- 高频细节在交织后容易脏。
- 大范围泛光会伤害轮廓清晰度。

## 3. 设计目标

- 做出“看起来就应该是主角机”的三维战机。
- 在静止、移动、开火、聚焦、自旋时都具备明确体积感。
- 在 C1 裸眼 3D 屏幕上优先保证轮廓、层次和主体存在感。
- 为后续敌机和 Boss 建立统一方法论。

## 4. 风格方向

### 4.1 参考气质

- `Ikaruga`：强轮廓、读形优先、整体锐利。
- `R-Type Final 2`：模块化机体、机械层次、主副结构分区。
- `Radiant Silvergun`：战斗中依然维持主体存在感与主题统一。

### 4.2 本项目推荐方向

- 主轮廓：长机鼻 + 主脊 + 折角主翼 + 双喷口。
- 机体气质：高速精英截击机，不是厚重轰炸机。
- 主配色：银白装甲、冷色座舱、青蓝能量线、橙色喷口核心。

## 5. 技术路线

## 5.1 几何结构

采用参数化程序化建模，不引入外部模型依赖。建议将玩家机拆成以下层级：

- nose：机鼻与前部装甲
- spine：主脊与上层舱体
- canopy：座舱外壳
- wingRoot：翼根连接层
- mainWing：主翼
- stabilizer：尾翼或副翼
- enginePod：引擎仓
- engineCore：喷口核心
- weaponRail：武装导轨
- lowerArmor：腹部护甲

## 5.2 材质系统

建议分四类：

- Hull：主体装甲，偏 `MeshStandardMaterial`
- Hero Coat：主角重点部位，偏 `MeshPhysicalMaterial`
- Canopy：座舱玻璃，受控假玻璃
- Energy：喷口、导轨、能量缝，使用 emissive 与 shader 增强

## 5.3 灯光系统

玩家机需要独立 hero lighting：

- key light：定义主表面
- fill light：补充暗部，不破坏方向感
- rim light：强化轮廓，服务裸眼 3D 读形
- optional env lighting：给 PBR 材质提供稳定反射基底

## 5.4 状态反馈

以下状态必须直接反馈到机体自身，而不只依赖特效：

- idle
- firing
- focus
- hit
- spin

对应可驱动参数：

- emissive intensity
- canopy brightness
- engine pulse
- edge fresnel
- rail glow

## 6. C1 专项约束

- 机体厚度要真实存在，不能靠纯颜色骗空间感。
- 细节粒度以中尺度为主，小刻线只作点缀。
- 大面积透明和模糊后处理要慎用。
- 常态深度控制在稳定观看区，技能演出再短时增强。

## 7. 正式执行方式

研发时以任务卡推进，不再使用按天排期。

执行入口：

- [TASKPACK_STEP1A_PLAYER_SHIP_REDESIGN.md](E:\AI\C1_Air_Game\C1_Air_Game\docs\production\TASKPACK_STEP1A_PLAYER_SHIP_REDESIGN.md)

关联总控：

- [PHASE_V2_VISUAL_MASTER_PLAN.md](E:\AI\C1_Air_Game\C1_Air_Game\docs\production\PHASE_V2_VISUAL_MASTER_PLAN.md)
