# Void Strike — 开发环境搭建与 Phase 1 启动指南

> 本文档由 Cowork 预备阶段自动生成。在运行 `npm install` 和开始 Claude Code 开发前，请仔细阅读。

---

## 一、项目当前状态（预备完成）

以下文件和目录已由 Cowork 预先创建，Claude Code 可直接开始代码开发：

```
C1_Air_Game/
├── package.json                    ✅ 已配置（依赖已声明，待 npm install）
├── vite.config.ts                  ✅ 已配置
├── tsconfig.json                   ✅ 已配置（严格模式）
├── tsconfig.node.json              ✅ 已配置
├── electron-builder.yml            ✅ 已配置
├── index.html                      ✅ 已创建
├── plugins/
│   ├── vite.elctron.dev.ts         ✅ 已适配（入口改为 src/main/index.ts）
│   └── vite.elctron.build.ts       ✅ 已适配
├── scripts/
│   └── download-fonts.mjs          ✅ 字体下载脚本（首次运行前执行）
├── src/
│   ├── shared/
│   │   └── types.ts                ✅ 共享类型定义（DeviceParams、IPC事件等）
│   ├── main/
│   │   ├── index.ts                ✅ Electron 主进程（窗口管理 + 管道连接）
│   │   ├── preload.ts              ✅ IPC 桥接脚本
│   │   └── pipe-client.ts          ✅ OpenstageAI 命名管道客户端
│   └── renderer/
│       ├── main.ts                 ✅ Vue 入口
│       ├── App.vue                 ✅ 根组件（含 HUD 占位 + C1参数监听）
│       ├── assets/fonts/
│       │   └── fonts.css           ✅ 字体 CSS（待执行下载脚本后生效）
│       ├── rendering/
│       │   ├── InterleavingShader.ts ✅ C1 交织着色器 TypeScript 封装
│       │   └── shaders/
│       │       ├── interleaving.vert ✅ 顶点着色器（GLSL）
│       │       ├── interleaving.frag ✅ 片段着色器（GLSL，含详细注释）
│       │       ├── bullet-glow.frag  ✅ 子弹发光着色器
│       │       └── explosion.frag    ✅ 爆炸效果着色器
│       ├── game/
│       │   ├── GameConfig.ts       ✅ 全局配置（C1参数、管道名、景深层等）
│       │   └── audio/
│       │       └── AudioManager.ts ✅ Web Audio API 程序化音效（无需外部文件）
│       └── utils/
│           ├── pool.ts             ✅ 对象池（子弹/粒子管理）
│           └── math.ts             ✅ 数学工具（景深计算、视角偏移等）
```

**待 Claude Code 实现的文件**（Phase 1 核心任务）：
```
src/renderer/rendering/
├── C1Renderer.ts          ← 多视角渲染器（最关键！）
├── MultiViewCamera.ts     ← 多视角相机控制
└── DepthLayerManager.ts   ← 景深层管理

src/renderer/game/
├── Game.ts                ← 游戏主类
├── GameLoop.ts            ← 固定时间步长循环
├── GameState.ts           ← 状态机
├── scenes/
│   ├── SceneManager.ts
│   ├── TitleScene.ts
│   └── GameplayScene.ts
├── entities/
│   ├── Entity.ts
│   ├── Player.ts
│   └── Enemy.ts
└── systems/
    ├── InputManager.ts
    ├── CollisionSystem.ts
    └── ScrollMap.ts
```

---

## 二、首次搭建开发环境

### 2.1 前置要求

- Node.js 20+（建议使用 nvm）
- Windows 10/11（Electron 需要 Windows 环境运行 C1 检测）
- C1 显示器（可选，无 C1 时以单视角普通模式运行）
- OpenstageAI 软件（中国区，非国际版 Cubestage）

### 2.2 安装依赖

```bash
# 进入项目目录
cd C1_Air_Game

# 安装 npm 依赖（包括 three.js、electron 等）
npm install

# 下载游戏字体（Orbitron、Share Tech Mono，OFL 开源许可）
node scripts/download-fonts.mjs
```

### 2.3 启动开发服务器

```bash
npm run dev
```

这会同时启动 Vite 开发服务器和 Electron 窗口。如果检测到 C1 显示器，游戏会在 C1 上全屏启动。

---

## 三、⚠️  重要：中国区版本说明

**本项目专为中国区版本开发，与国际版有以下差异：**

| 项目 | 中国区（本项目）| 国际版（不适用）|
|------|--------------|----------------|
| 平台软件 | OpenstageAI | Cubestage |
| 命名管道名 | `OpenstageAI_server_pipe` | `Cubestage_server_pipe` |

**已在代码中正确配置**（`src/renderer/game/GameConfig.ts`）：
```typescript
export const PIPE_CONFIG = {
  PIPE_NAME: 'OpenstageAI_server_pipe',
  PIPE_PATH: '\\\\.\\pipe\\OpenstageAI_server_pipe',
  // ...
}
```

**开发时 C1 参数获取流程**：
1. 确保 OpenstageAI 软件已启动并登录
2. 启动游戏，主进程自动通过管道发送 `getDeivice` 请求
3. 收到响应后，`pipe-client.ts` 会 emit `deviceParams` 事件
4. 主进程通过 IPC 推送参数到渲染进程
5. 渲染进程更新交织着色器的 `slope/interval/x0` uniform 值

**如果连接 OpenstageAI 失败**：
- 游戏自动降级到单视角模式（普通 3D 渲染）
- 使用 `GameConfig.ts` 中的 `DEFAULT_GRATING_PARAMS` 作为后备参数
- 屏幕左上角会显示"未连接 C1（普通模式）"提示

---

## 四、Phase 1 开发任务（给 Claude Code）

直接将 `docs/04_CLAUDE_CODE_PROMPT.md` 中的 **Phase 1 启动提示词** 复制给 Claude Code 即可。

Claude Code 需要重点实现的核心模块：

### 优先级 1 — C1 渲染管线（必须先验证）
参考文件：
- `src/renderer/rendering/InterleavingShader.ts`（已完成，直接使用）
- `reference/3DMonitor/src/view/viewer/index.vue`
- `reference/3DMonitor/src/view/viewer/shader.ts`

关键实现要点：
```typescript
// C1Renderer.ts 的核心渲染循环
for (let i = 0; i < 40; i++) {
  const col = i % 8
  const row = Math.floor(i / 8)
  
  camera.position.x = baseCamX + viewCameraOffset(i, FOCAL_PLANE, 40)
  camera.updateMatrixWorld()
  
  renderer.setViewport(col * SUB_WIDTH, row * SUB_HEIGHT, SUB_WIDTH, SUB_HEIGHT)
  renderer.setScissor(col * SUB_WIDTH, row * SUB_HEIGHT, SUB_WIDTH, SUB_HEIGHT)
  renderer.setScissorTest(true)
  renderer.setRenderTarget(multiViewTarget)
  renderer.render(scene, camera)
}
// 然后用 InterleavingShaderDef 的 ShaderPass 输出到屏幕
```

### 优先级 2 — 游戏主循环
`GameLoop.ts` 实现固定时间步长（60FPS 逻辑，30FPS 渲染）

### 优先级 3 — 玩家飞机 + 输入
`Player.ts` + `InputManager.ts`，Three.js 几何体组合飞机模型

### 优先级 4 — 最小可玩原型
2~3 种小型敌机、基础碰撞、卷轴地面、HUD

---

## 五、目录别名速查

代码中使用以下路径别名：

| 别名 | 实际路径 |
|------|---------|
| `@/` | `src/renderer/` |
| `@main/` | `src/main/` |
| `@shared/` | `src/shared/` |

---

## 六、常见问题

**Q: 运行 `npm run dev` 后窗口没有出现**
- 检查 `dist/background.js` 是否已生成（esbuild 编译）
- 查看终端错误输出

**Q: C1 显示器没有被检测到**
- 确认 C1 已连接并在 Windows 显示器设置中可见
- 检查 `src/main/index.ts` 中的 `checkAndCreateGameWindow()` 逻辑

**Q: 交织效果不对（3D效果看起来不对劲）**
- 确认 `slope/interval/x0` 是否正确从 OpenstageAI 获取
- 如无 OpenstageAI，检查 `DEFAULT_GRATING_PARAMS` 是否合理
- 参考 `reference/3DMonitor/src/view/viewer/shader.ts` 对比着色器逻辑

**Q: 性能太差（帧率过低）**
- 降低子视角分辨率：修改 `GameConfig.ts` 中的 `SUB_WIDTH`/`SUB_HEIGHT`（如 180×320）
- 减少视角数量：将 `VIEW_COUNT` 改为 20 或 10
- 使用 `THREE.InstancedMesh` 处理大量相同对象
