# C1 Air Game (Void Strike) - Codex 项目说明

## 项目概述

这是一个为 CubeVi C1 裸眼3D显示器（1440x2560 竖屏）开发的竖版卷轴射击游戏，类似《雷电》《打击者1945》。使用 Electron + Vite + Vue 3 + Three.js（纯 WebGL，不使用游戏引擎），通过多视角渲染和光栅交织着色器实现裸眼3D效果。

## 关键文档（必读）

- `docs/01_C1_DISPLAY_TECH_GUIDE.md` — C1 显示屏3D技术要点，包含交织着色器原理和完整代码
- `docs/02_GAME_SYSTEM_ARCHITECTURE.md` — 完整游戏系统架构设计，包含所有子系统设计
- `docs/03_ASSET_REQUIREMENTS.md` — 素材需求清单，所有3D模型使用代码程序化生成
- `docs/04_CLAUDE_CODE_PROMPT.md` — 开发任务提示词和分阶段计划
- `docs/05_SETUP_GUIDE.md` — **开发环境搭建指南（预备阶段已完成的文件清单、启动步骤）**

## 参考项目

`reference/3DMonitor/` 目录包含 CubeVi 官方开源的 3DMonitor 应用完整源码。这是唯一的 C1 开发参考实现。重点参考文件：

- `reference/3DMonitor/src/view/viewer/shader.ts` — **交织着色器核心**
- `reference/3DMonitor/src/view/viewer/config.ts` — 显示参数
- `reference/3DMonitor/src/view/viewer/index.vue` — Three.js渲染流程
- `reference/3DMonitor/src/view/viewer/index_babylon.vue` — Babylon.js渲染+多层深度
- `reference/3DMonitor/src/view/viewer/multilayer.ts` — 多层深度着色器
- `reference/3DMonitor/src/background.ts` — Electron主进程 + 命名管道通信
- `reference/3DMonitor/src/preload.ts` — IPC桥接

## ⚠️  重要：中国区版本

**本项目为中国区版本，使用 OpenstageAI（不是国际版 Cubestage）！**

- 命名管道名：**`OpenstageAI_server_pipe`**（已在 `GameConfig.ts` 中正确配置）
- 国际版管道名 `Cubestage_server_pipe` 在本项目中不适用
- 所有 Named Pipe 相关代码必须使用 `OpenstageAI_server_pipe`

## 技术栈

- **运行时**: Electron 28+
- **构建**: Vite 5+
- **UI框架**: Vue 3 + TypeScript
- **3D渲染**: Three.js (r166+)
- **后处理**: Three.js EffectComposer + 自定义交织ShaderPass
- **桌面集成**: Windows Named Pipe（与 **OpenstageAI** 通信获取光栅参数）

## C1 3D 渲染核心流程

1. 通过命名管道从 **OpenstageAI**（`OpenstageAI_server_pipe`）获取三个光栅参数：slope, interval, x0
2. 设置多视角相机阵列（40个视角，8x5网格）
3. 每帧渲染40次场景（每次相机有水平偏移），结果写入一张纹理图集
4. 通过交织后处理着色器将纹理图集转换为C1可显示的交织图像
5. 交织着色器中 RGB 三通道分别使用 bias=0/1/2 独立寻址

## 游戏核心特性

- 竖版卷轴射击，从上至下固定速度滚动
- 3种武器：点射(Shot)、散射(Spread)、激光(Laser)
- 5条默认生命，可设置无限生命模式
- 碰撞判定：敌方子弹/撞击敌机 = 损失1生命
- 擦弹系统：子弹近身通过但未命中有分数奖励
- 10个阶段地貌：从地表→火山→太空→黑洞
- 每阶段结尾有Boss战，Boss击杀后地貌过渡
- 完整计分：杀敌 + 拾取 + 擦弹 + Combo连杀

## 开发优先级

Phase 1 (MVP): 基础框架 + C1渲染管线 + 玩家飞机 + 小型敌机 + 基础射击
Phase 2: Boss系统 + 弹幕系统 + 地貌切换 + 道具 + 计分
Phase 3: 完整10阶段 + 全部Boss + 特效打磨 + 音频

## 代码规范

- TypeScript 严格模式
- 类组织：每个系统一个文件，使用 class + export
- 命名：PascalCase 类名，camelCase 方法/变量
- 注释：关键算法和C1相关代码必须注释
- 对象池模式管理子弹和粒子
- 固定时间步长游戏循环（逻辑60FPS，渲染可降帧）
