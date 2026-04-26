# V2 Visual Upgrade Master Plan

## 1. 目标

本阶段目标是在不破坏当前 C1 多视角渲染链路稳定性的前提下，系统性提升玩家飞船、非 Boss 敌人、Boss、地形与战斗特效的三维表现力。

当前最高优先级不是“整体一起变好”，而是先把玩家主角飞船做成整个项目的视觉标杆。原因很直接：

- 玩家飞船是全程驻场对象，视觉短板会持续暴露。
- 玩家飞船是 C1 裸眼 3D 深度感最容易被感知的对象。
- 玩家飞船一旦建立稳定的造型、材质、灯光与特效方法论，后续敌机和 Boss 就能沿着同一条技术路线复制。

## 2. 阶段划分

### Step 1A：玩家飞船重设计

- 建立主角飞船新的造型语言。
- 建立 C1 友好的英雄材质和英雄布光方案。
- 建立假玻璃、喷口、能量导轨、边缘高光等核心表现模块。
- 输出可复用的 `PlayerShipV2` 构建规范。

### Step 1B：非 Boss 敌人与基础战斗视觉统一

- 基于 Step 1A 的视觉语言升级普通敌机。
- 统一命中、击毁、尾焰、武器发光的表现规则。
- 保证玩家机与敌机在深度、轮廓、色彩上明确分层。

### Step 2：Boss 模型与演出升级

- 将玩家机阶段建立的建模和材质体系扩展到 Boss。
- 强化大体块分层、弱点识别、阶段切换与登场演出。

### Step 3：地形与关卡表现升级

- 将关卡背景、地貌装饰和空间层次统一到同一视觉体系。
- 避免背景喧宾夺主，始终为玩家机和战斗信息让位。

## 3. 全局原则

### 3.1 视觉原则

- 轮廓优先：远距离一眼识别机体姿态，比堆小细节更重要。
- 厚度优先：C1 裸眼 3D 更需要稳定体积感，避免过薄翼片和纯平轮廓。
- 分层优先：机鼻、主脊、翼面、武装、喷口必须形成清晰前后层次。
- 控光优先：高光、边缘光、发光只服务于读形，不做全身平均发亮。
- 主角优先：任何背景、敌机、特效都不能抢走主角飞船的第一视觉重心。

### 3.2 技术原则

- 先解决造型、材质、灯光，再评估 bloom 等模糊型后处理。
- 优先使用 `MeshStandardMaterial` / `MeshPhysicalMaterial` 配合环境反射。
- 环境反射优先采用 Three.js 官方 `PMREMGenerator` 路线。
- 所有新增方案必须兼容当前 `C1Renderer` 的 40 视角 atlas + interleaving 流程。
- 透明和半透明效果优先使用“假玻璃”与受控 shell，不直接依赖重度折射。

### 3.3 代理协作原则

- 不使用按天排期。
- 只使用“任务卡 + 验收标准 + 文件边界”推进研发。
- 每个代理一次只领取一个 TaskPack。
- 提交必须说明：改动文件、关键参数、性能影响、C1 观察结果。

## 4. 关键风险

### 4.1 视觉风险

- 机体细节过密，在交织后出现闪烁和噪点。
- 发光面积过大，导致主轮廓被吞掉。
- 背景或敌机亮度过高，压掉玩家机主体存在感。

### 4.2 技术风险

- 直接在交织输出后使用模糊型 bloom，污染视角像素分配。
- 透明材质排序在多视角下产生不稳定边缘。
- PBR 材质升级后没有环境反射，导致“材质变高级但画面更灰”。

## 5. 首批正式执行顺序

1. 先执行 [TASKPACK_STEP1A_PLAYER_SHIP_REDESIGN.md](E:\AI\C1_Air_Game\C1_Air_Game\docs\production\TASKPACK_STEP1A_PLAYER_SHIP_REDESIGN.md)
2. 再执行 [TASKPACK_STEP1_PLAYER_ENEMIES.md](E:\AI\C1_Air_Game\C1_Air_Game\docs\production\TASKPACK_STEP1_PLAYER_ENEMIES.md)
3. 玩家飞船方案验证通过后，再扩展到 Boss 与地形。

## 6. 参考与配套文档

- 总方案：[06_PLAYER_SHIP_REDESIGN_PLAN.md](E:\AI\C1_Air_Game\C1_Air_Game\docs\06_PLAYER_SHIP_REDESIGN_PLAN.md)
- 执行看板：[PARALLEL_EXECUTION_BOARD.md](E:\AI\C1_Air_Game\C1_Air_Game\docs\production\PARALLEL_EXECUTION_BOARD.md)
- 主角飞船任务卡：[TASKPACK_STEP1A_PLAYER_SHIP_REDESIGN.md](E:\AI\C1_Air_Game\C1_Air_Game\docs\production\TASKPACK_STEP1A_PLAYER_SHIP_REDESIGN.md)
- 敌机任务卡：[TASKPACK_STEP1_PLAYER_ENEMIES.md](E:\AI\C1_Air_Game\C1_Air_Game\docs\production\TASKPACK_STEP1_PLAYER_ENEMIES.md)
