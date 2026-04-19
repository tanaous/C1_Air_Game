# Claude Code 开发任务提示词

## 启动提示词（直接复制粘贴给 Claude Code）

---

### Phase 1 启动提示词 — 基础框架与C1渲染管线

```
我需要你帮我开发一个为 CubeVi C1 裸眼3D显示器设计的竖版卷轴射击游戏（类似雷电/打击者1945）。

## 首先请阅读以下文档：
1. 先读 CLAUDE.md 了解项目整体概况
2. 读 docs/01_C1_DISPLAY_TECH_GUIDE.md 了解C1显示屏3D技术原理
3. 读 docs/02_GAME_SYSTEM_ARCHITECTURE.md 了解游戏系统架构设计
4. 读 docs/03_ASSET_REQUIREMENTS.md 了解素材策略（所有3D模型用代码程序化生成）
5. 参考 reference/3DMonitor/ 目录中的官方开源参考项目源码，特别是：
   - reference/3DMonitor/src/view/viewer/shader.ts（交织着色器）
   - reference/3DMonitor/src/view/viewer/index.vue（Three.js渲染流程）
   - reference/3DMonitor/src/view/viewer/index_babylon.vue（多层深度实现）
   - reference/3DMonitor/src/view/viewer/multilayer.ts（深度着色器）
   - reference/3DMonitor/src/background.ts（Electron主进程 + 命名管道通信）
   - reference/3DMonitor/src/preload.ts（IPC桥接）
   - reference/3DMonitor/src/view/viewer/config.ts（显示参数配置）

## Phase 1 任务：搭建基础框架 + C1渲染管线 + 最小可玩原型

请按以下顺序实现：

### Step 1: 项目脚手架
- 使用 Vite + Vue 3 + TypeScript + Electron 搭建项目
- 参考 reference/3DMonitor/package.json 中的 Electron+Vite 集成方式
- 参考 reference/3DMonitor/plugins/ 目录中的 Vite Electron 插件
- 安装 three.js 和必要依赖
- 配置好 TypeScript、ESLint

### Step 2: Electron 主进程
- 参照 reference/3DMonitor/src/background.ts 实现：
  - Windows 命名管道客户端，连接 Cubestage (管道名: Cubestage_server_pipe)
  - 发送 getDeivice 请求获取 C1 光栅参数 (slope/interval/x0)
  - 通过 IPC 将参数传递给渲染进程
- 实现双窗口模式：
  - 主控窗口（可选，后续可加）
  - C1 全屏游戏窗口（检测C1显示器，全屏显示）
- 参照 reference/3DMonitor/src/preload.ts 实现 preload 脚本

### Step 3: C1 多视角渲染器（核心！）
- 这是整个项目最关键的部分，请仔细参考 reference/3DMonitor/src/view/viewer/ 下的所有文件
- 实现 C1Renderer 类（参见架构文档 3.2 节）：
  - 创建 WebGLRenderTarget 作为多视角纹理图集 (8列x5行, 每个子视角 288x512)
  - 实现 40 个视角的相机偏移渲染循环
  - 实现交织后处理着色器（直接参考 reference/3DMonitor/src/view/viewer/shader.ts 中的 Shader_Str_Template）
  - 着色器关键：RGB 三通道使用 bias=0/1/2 分别采样（对应 LCD 子像素物理偏移）
  - 使用 Three.js 的 EffectComposer + ShaderPass 实现后处理管线
  - 支持运行时更新 slope/interval/x0 uniform 值
- 实现景深控制（参考 multilayer.ts 中的 multilayer_z_multiply 函数）
- 提供降级模式：当未连接C1时，显示普通单视角渲染

### Step 4: 游戏主循环
- 实现固定时间步长游戏循环（逻辑 60FPS）
- 实现基础场景管理（标题→游戏→暂停→结束）
- 实现键盘输入管理器

### Step 5: 最小可玩原型
- 用 Three.js 基础几何体组合创建玩家飞机模型（参见素材文档 2.1）
- 实现方向键移动 + Z键射击
- 创建 2-3 种小型敌机（简单几何体）
- 实现基础碰撞检测（圆形碰撞箱）
- 实现简单的卷轴地面（PlaneGeometry + 颜色 + 向下移动）
- 实现基础 HUD（生命数 + 分数）

### 关键技术提示：
1. Three.js 的 WebGLRenderTarget 用于离屏渲染多视角纹理
2. 每个视角渲染时通过 renderer.setViewport + setScissor 限制渲染区域
3. 相机使用 PerspectiveCamera，俯视角（从上往下看），多视角时只做水平偏移
4. 交织着色器中 `(x + y * slope) * 3.0 + bias` 是核心公式，3.0 是因为 RGB 子像素
5. 游戏场景坐标系：X轴=左右，Y轴=上下（屏幕滚动方向），Z轴=深度（用于3D效果）
6. 所有3D模型都用 Three.js 几何体组合程序化生成，不需要加载外部模型文件
7. 先确保 C1 渲染管线正确工作（即使只显示一个旋转立方体也行），再叠加游戏逻辑

请开始实现，遇到设计决策时参考架构文档中的建议。每完成一个 Step 先确认其可运行再继续下一步。
```

---

### Phase 2 提示词 — 完善游戏系统

```
继续 C1 Air Game 开发，进入 Phase 2：完善游戏系统。

请先回顾 docs/02_GAME_SYSTEM_ARCHITECTURE.md 和 docs/03_ASSET_REQUIREMENTS.md。

## Phase 2 任务：

### Step 6: 完善武器系统
- 实现三种武器类型（参见架构文档 3.4.2 节）：
  - 点射(Shot)：高伤害直线子弹，按住Z连射
  - 散射(Spread)：扇形多发子弹
  - 激光(Laser)：持续照射光束
- C键切换武器
- 每种武器支持 5 级升级
- 子弹使用对象池管理

### Step 7: 完善敌机系统
- 实现全部敌机类型（参见架构文档 3.4.3 节）
- 实现波次生成器 WaveSpawner（基于卷轴距离触发）
- 敌机有基础AI：直线、弧形、悬停射击等
- 实现敌方弹幕系统（参见架构文档 3.5 节）：
  - 至少实现 5 种弹幕模式：自机狙、环形、螺旋、扇形、弹帘

### Step 8: Boss 系统
- 实现 Boss 基类（多阶段 HP 系统，参见架构文档 3.4.4 节）
- 实现前 3 个 Boss（参见素材文档 2.3）：
  - Boss 1: 要塞守卫（四角炮塔 + 中央弱点）
  - Boss 2: 沙暴蝎（双钳机械蝎）
  - Boss 3: 深海霸王（航母 + 舰载机）
- 每个 Boss 出现前显示 "WARNING" 警告
- Boss HP 血条在屏幕顶部显示

### Step 9: 地貌系统
- 实现 TerrainGenerator 程序化地形（参见架构文档第五节 + 素材文档第三节）
- 实现前 5 个地貌主题（地表阶段）
- 实现地貌过渡效果（Boss击杀后渐变）
- 地形装饰物（简单几何体）

### Step 10: 道具与计分
- 实现全部道具类型（参见架构文档 3.8 节）
- 敌机被击杀后随机掉落道具
- 实现完整计分系统（参见架构文档 3.7 节）：
  - 杀敌得分 + 道具得分 + 擦弹得分 + Combo连杀
- 实现擦弹检测（grazeRadius 判定）

### Step 11: C1 3D 深度效果
- 为不同游戏元素配置合适的 C1 景深值（参见技术文档第五节 5.3）：
  - 背景地形：-3~-5cm（凹入）
  - 敌机：-1~0cm
  - 玩家：+1~+2cm（弹出）
  - 子弹/特效：+2~+3cm（弹出）
- Boss 入场动画：从远处推近
- 爆炸碎片向前弹出

### Step 12: 设置面板
- 实现游戏设置：
  - 生命数设置（5条 / 无限）
  - 难度选择
  - 按键重映射
  - 显示性能选项（视角数量 40/20/10）
  - 显示 FPS
```

---

### Phase 3 提示词 — 完整内容与打磨

```
继续 C1 Air Game 开发，进入 Phase 3：完整内容与打磨。

## Phase 3 任务：

### Step 13: 完成全部 Boss (4-10)
- 参见 docs/03_ASSET_REQUIREMENTS.md 中的 Boss 4-10 设计
- 每个 Boss 有独特的攻击模式和多阶段战斗
- Boss 10 (最终Boss) 融合所有前Boss的攻击模式

### Step 14: 完成太空阶段地貌 (6-10)
- 太空阶段不再有地面，改为星空背景+漂浮物
- 实现星云效果（粒子系统）
- 实现小行星带（旋转不规则几何体）
- 实现黑洞视觉效果（着色器空间扭曲）

### Step 15: 难度递进系统
- 实现 DifficultyManager（参见架构文档 3.9 节）
- 随卷轴距离增加：敌机增多、弹幕加密、敌机血量增加
- 保持游戏节奏：紧张和舒缓交替

### Step 16: 视觉打磨
- 完善爆炸粒子效果
- 添加屏幕震动效果（Boss攻击/大爆炸）
- 发光着色器效果（子弹、引擎尾焰）
- 护盾视觉效果
- 打磨 HUD 和 UI 设计

### Step 17: 音频系统（可选）
- 使用 Web Audio API 程序化生成简单音效
- 或集成少量 CC0 开源音效文件
- BGM 可后续添加

### Step 18: 游戏结束与重玩
- 完善 Game Over 画面
- 本地高分排行榜（localStorage）
- 重玩流程优化
- 标题画面完善

### Step 19: 性能优化
- 分析渲染瓶颈
- 优化多视角渲染（必要时降低子视角分辨率）
- 确保稳定 30FPS（40视角模式）
- 内存泄漏检查

### Step 20: 打包发布
- 使用 electron-builder 打包为 Windows 安装程序
- 参考 reference/3DMonitor/ 的打包配置
- 测试在 C1 显示器上的实际3D效果
```

---

## 补充说明

### 如果 Claude Code 遇到问题

1. **C1 交织着色器不工作**：
   - 首先确认 `tDiffuse` uniform 正确绑定了多视角纹理
   - 检查 `gridSizeX=1440, gridSizeY=2560` 是否正确
   - 确认 `imgs_count_x=8, imgs_count_y=5`
   - 检查 RGB 三通道的 bias 是否分别为 0, 1, 2
   - 参考 `reference/3DMonitor/src/view/viewer/shader.ts` 中的原始实现

2. **性能太差**：
   - 先降低子视角分辨率（如 180x320）
   - 减少视角数量（如只用 20 个或 10 个）
   - 使用 `THREE.InstancedMesh` 处理大量相同的敌机/子弹
   - 使用对象池避免频繁创建销毁

3. **无法连接 Cubestage**：
   - 确保 Cubestage 软件已启动并登录
   - 管道名确认为 `Cubestage_server_pipe`（国际版）或 `OpenstageAI_server_pipe`（中文版）
   - 提供降级模式：无C1时使用默认参数或单视角模式

4. **C1 检测不到**：
   - 参考 `reference/3DMonitor/src/background.ts` 中的 `checkDisplay()` 函数
   - 通过 `screen.getAllDisplays()` 枚举显示器
   - 可能的 C1 标签: 平台提供的 labelList 或 fallback `'TPV-2288-IN'`

### 不使用 npm 而使用其他包管理器

参考项目同时包含 `package-lock.json` 和 `pnpm-lock.yaml`，两种包管理器都可用。建议使用 npm 以保持简单。
