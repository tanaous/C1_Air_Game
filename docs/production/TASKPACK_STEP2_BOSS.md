# TASKPACK Step 2：Boss 模型与动画演出升级

## 2026-04-29 状态

- Boss 模型、分层表现、前摇提示、Boss 子弹压迫感已纳入 C1-safe 效果恢复路线。
- 旧的大面积透明危险提示不再作为 C1 主路径；当前使用 opaque PBR telegraph 和局部 Boss 子弹 glow/trail。
- Boss 子弹短局部拖尾已通过 C1 实机确认；下一步不要同时加入 Boss 全屏闪白、bloom 或大面积透明罩。

## 目标

将 Boss 从“功能实体”升级为“多阶段、强压迫感、可读招”的演出核心，形成与小怪显著拉开的尺度感、深度冲击与视觉记忆点。

## 交付范围

1. Boss 结构分层
- 核心区 / 装甲区 / 武器区 / 弱点区明确分层。
- 阶段切换时结构可见变化（装甲剥离、弱点暴露、能量回路重构）。

2. 动画与状态机
- 待机、转向、蓄力、放招、硬直、崩解完整状态集合。
- 状态过渡时间可配置，支持阶段差异化参数。

3. 阶段演出
- Phase 切换特效（护盾破裂、局部爆闪、能量重组）。
- 大招前提示（画面压暗 + 高亮导引 + 危险区提示）。

## Boss 模板规范（可直接编码）

### A. 结构节点规范
- `root`
  - `armorLayer`
  - `coreLayer`
  - `weaponLayer`
  - `weakPointLayer`

要求：每层使用独立材质组，支持单层开关/透明度/发光强度调节。

### B. 状态机模板
- `idle`
- `aim`
- `charge`
- `attack`
- `recover`
- `phaseTransition`
- `breakdown`

状态切换建议：
- `idle -> aim -> charge -> attack -> recover -> idle`
- `phaseTransition` 可从任意非 `breakdown` 状态中断进入。

### C. 阶段参数模板

```ts
interface BossPhaseVisualConfig {
  phase: number
  armorOpacity: number
  coreEmissive: number
  weakPointExposure: number
  attackTelegraphMs: number
  transitionDurationMs: number
  screenDarken: number
}
```

默认建议：
- Phase1：装甲高、弱点低暴露、提示较长
- Phase2：装甲下降、弱点提升、提示中等
- Phase3：装甲低、核心高发光、提示更短但更强对比

## 技术要求

- 动画可使用层级节点+曲线驱动，不强依赖骨骼工具。
- 大体积特效遵循“短时高冲击、快速衰减”。
- 演出不得遮蔽玩家规避信息。
- 所有阶段参数从配置读取，避免散落硬编码。

## 实施步骤

1. 选当前首个 Boss 作为模板原型。
2. 完成结构层与材质层拆分。
3. 按状态机模板接入关键动作。
4. 接入阶段切换演出与危险提示。
5. 联动 HUD（阶段、弱点暴露状态）。
6. 按 QA 清单做可读性与深度验证。

## 验收标准（DoD）

- 每次 Phase 变化在 1 秒内可被玩家识别。
- Boss 深度与尺寸压迫感显著高于普通敌人。
- 大招前摇与危险区域提示清晰。
- 阶段切换后玩法可读性无下降。

## 提交要求

- 阶段演出说明（触发条件、持续时间、视觉目的）。
- 参数表（每阶段核心视觉参数）。
- 性能说明（特效峰值、是否触发降级策略）。
