# C1 Air Game - 完整游戏系统架构设计文档

## 项目概述

**项目名称**: C1 Air Game（暂定：Void Strike / 虚空突击）  
**类型**: 竖版卷轴射击游戏（STG/Shoot'em up）  
**参考作品**: 雷电、打击者1945、1942  
**目标平台**: CubeVi C1 裸眼3D显示器（1440x2560，竖屏）  
**技术栈**: Electron + Vite + Vue 3 + Three.js（WebGL），不使用游戏引擎  
**渲染方式**: 实时3D渲染 + C1光栅交织后处理

---

## 一、整体技术架构

```
┌─────────────────────────────────────────────────┐
│                Electron Main Process             │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────┐│
│  │ Named Pipe  │  │ Window Mgr   │  │  IPC    ││
│  │ (Cubestage) │  │ (C1 detect)  │  │ Bridge  ││
│  └─────────────┘  └──────────────┘  └─────────┘│
└───────────────────────┬─────────────────────────┘
                        │ IPC
┌───────────────────────┴─────────────────────────┐
│              Renderer Process (C1 Window)         │
│  ┌──────────────────────────────────────────────┐│
│  │              Vue 3 App Shell                  ││
│  │  ┌────────────────────────────────────────┐  ││
│  │  │         Game Engine (Custom)            │  ││
│  │  │  ┌──────┐ ┌──────┐ ┌───────┐ ┌──────┐│  ││
│  │  │  │Scene │ │Entity│ │Bullet │ │Score ││  ││
│  │  │  │Mgr   │ │System│ │System │ │System││  ││
│  │  │  └──────┘ └──────┘ └───────┘ └──────┘│  ││
│  │  │  ┌──────┐ ┌──────┐ ┌───────┐ ┌──────┐│  ││
│  │  │  │Input │ │Collisn│ │Scroll │ │Power ││  ││
│  │  │  │Mgr   │ │Detect │ │Map   │ │Up Mgr││  ││
│  │  │  └──────┘ └──────┘ └───────┘ └──────┘│  ││
│  │  └────────────────────────────────────────┘  ││
│  │  ┌────────────────────────────────────────┐  ││
│  │  │       Three.js Rendering Pipeline       │  ││
│  │  │  ┌──────────┐  ┌──────────────────┐    │  ││
│  │  │  │Multi-View│→ │ C1 Interleaving  │    │  ││
│  │  │  │ Renderer │  │ Post-Process     │    │  ││
│  │  │  └──────────┘  └──────────────────┘    │  ││
│  │  └────────────────────────────────────────┘  ││
│  └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

## 二、目录结构设计

```
C1_Air_Game/
├── reference/                  # 参考项目（3DMonitor源码）
│   └── 3DMonitor/
├── docs/                       # 项目文档
│   ├── 01_C1_DISPLAY_TECH_GUIDE.md
│   ├── 02_GAME_SYSTEM_ARCHITECTURE.md
│   ├── 03_ASSET_REQUIREMENTS.md
│   └── 04_CLAUDE_CODE_PROMPT.md
├── src/
│   ├── main/                   # Electron 主进程
│   │   ├── index.ts            # 主进程入口
│   │   ├── pipe-client.ts      # Cubestage 命名管道通信
│   │   ├── window-manager.ts   # 窗口管理（检测C1/创建全屏窗口）
│   │   └── preload.ts          # 预加载脚本（IPC桥）
│   ├── renderer/               # 渲染进程（游戏主体）
│   │   ├── index.html
│   │   ├── main.ts             # Vue 入口
│   │   ├── App.vue
│   │   ├── game/               # 游戏核心
│   │   │   ├── Game.ts                 # 游戏主类 - 生命周期管理
│   │   │   ├── GameLoop.ts             # 游戏主循环（requestAnimationFrame）
│   │   │   ├── GameConfig.ts           # 全局配置常量
│   │   │   ├── GameState.ts            # 游戏状态机
│   │   │   ├── scenes/
│   │   │   │   ├── SceneManager.ts     # 场景管理器
│   │   │   │   ├── TitleScene.ts       # 标题画面
│   │   │   │   ├── GameplayScene.ts    # 主游戏场景
│   │   │   │   ├── PauseScene.ts       # 暂停界面
│   │   │   │   └── GameOverScene.ts    # 结算画面
│   │   │   ├── entities/
│   │   │   │   ├── Entity.ts           # 实体基类
│   │   │   │   ├── Player.ts           # 玩家飞机
│   │   │   │   ├── Enemy.ts            # 敌机基类
│   │   │   │   ├── EnemyTypes.ts       # 敌机类型定义
│   │   │   │   ├── Boss.ts             # Boss 基类
│   │   │   │   ├── BossTypes.ts        # Boss 类型定义
│   │   │   │   ├── Bullet.ts           # 子弹基类
│   │   │   │   ├── PlayerBullets.ts    # 玩家三种弹药实现
│   │   │   │   ├── EnemyBullets.ts     # 敌方弹幕模式
│   │   │   │   ├── PowerUp.ts          # 道具/宝物
│   │   │   │   └── Explosion.ts        # 爆炸效果
│   │   │   ├── systems/
│   │   │   │   ├── InputManager.ts     # 键盘输入管理
│   │   │   │   ├── CollisionSystem.ts  # 碰撞检测系统
│   │   │   │   ├── ScrollMap.ts        # 卷轴地图系统
│   │   │   │   ├── TerrainGenerator.ts # 地形程序化生成
│   │   │   │   ├── WaveSpawner.ts      # 敌机波次生成器
│   │   │   │   ├── ScoreSystem.ts      # 计分系统
│   │   │   │   ├── DifficultyManager.ts# 难度递进管理
│   │   │   │   └── ParticleSystem.ts   # 粒子特效系统
│   │   │   └── audio/
│   │   │       └── AudioManager.ts     # 音频管理（可选）
│   │   ├── rendering/          # 渲染系统
│   │   │   ├── C1Renderer.ts           # C1 多视角渲染器
│   │   │   ├── InterleavingShader.ts   # 光栅交织着色器
│   │   │   ├── MultiViewCamera.ts      # 多视角相机控制器
│   │   │   ├── DepthLayerManager.ts    # 景深层管理
│   │   │   ├── ModelLoader.ts          # 3D模型加载器
│   │   │   └── shaders/               # 自定义着色器
│   │   │       ├── interleaving.frag   # 交织片段着色器
│   │   │       ├── interleaving.vert   # 交织顶点着色器
│   │   │       ├── bullet-glow.frag    # 子弹发光效果
│   │   │       └── explosion.frag      # 爆炸效果
│   │   ├── ui/                 # 游戏UI（Vue组件 / HTML overlay）
│   │   │   ├── HUD.vue                 # 抬头显示（生命/分数/武器）
│   │   │   ├── TitleScreen.vue         # 标题画面
│   │   │   ├── PauseMenu.vue           # 暂停菜单
│   │   │   ├── GameOverScreen.vue      # 游戏结束画面
│   │   │   └── SettingsPanel.vue       # 设置面板
│   │   ├── assets/             # 静态资源
│   │   │   ├── models/         # 3D模型（.glb/.gltf）
│   │   │   ├── textures/       # 纹理贴图
│   │   │   ├── audio/          # 音效和音乐
│   │   │   └── fonts/          # 字体
│   │   └── utils/
│   │       ├── math.ts                 # 数学工具函数
│   │       ├── pool.ts                 # 对象池
│   │       └── constants.ts            # 常量定义
│   └── shared/                 # 主进程/渲染进程共享类型
│       └── types.ts
├── package.json
├── vite.config.ts
├── tsconfig.json
├── electron-builder.yml
└── CLAUDE.md                   # Claude Code 项目说明
```

## 三、核心系统详细设计

### 3.1 游戏主循环 (GameLoop.ts)

```typescript
class GameLoop {
    private lastTime: number = 0
    private accumulator: number = 0
    private readonly fixedDt: number = 1000 / 60  // 逻辑帧60FPS
    private running: boolean = false
    
    start() {
        this.running = true
        this.lastTime = performance.now()
        requestAnimationFrame(this.tick.bind(this))
    }
    
    private tick(currentTime: number) {
        if (!this.running) return
        
        const frameTime = currentTime - this.lastTime
        this.lastTime = currentTime
        this.accumulator += frameTime
        
        // 固定时间步长物理/逻辑更新
        while (this.accumulator >= this.fixedDt) {
            this.update(this.fixedDt / 1000)  // 传入秒数
            this.accumulator -= this.fixedDt
        }
        
        // 渲染（可能低于逻辑帧率，取决于C1渲染开销）
        const alpha = this.accumulator / this.fixedDt
        this.render(alpha)  // alpha 用于插值平滑
        
        requestAnimationFrame(this.tick.bind(this))
    }
    
    private update(dt: number) {
        // 1. 处理输入
        // 2. 更新卷轴位置
        // 3. 生成敌机波次
        // 4. 更新所有实体
        // 5. 碰撞检测
        // 6. 处理碰撞结果
        // 7. 清理已销毁实体
        // 8. 更新分数/状态
    }
    
    private render(alpha: number) {
        // 1. 更新3D场景
        // 2. 渲染40个视角到纹理图集
        // 3. C1交织后处理
        // 4. 输出到屏幕
    }
}
```

### 3.2 C1 多视角渲染器 (C1Renderer.ts)

这是整个项目的技术核心，负责将游戏场景渲染为C1可显示的交织图像。

```typescript
class C1Renderer {
    // 配置常量
    static readonly OUTPUT_WIDTH = 1440
    static readonly OUTPUT_HEIGHT = 2560
    static readonly VIEW_COLS = 8
    static readonly VIEW_ROWS = 5
    static readonly VIEW_COUNT = 40
    static readonly SUB_WIDTH = 288   // 可降低以提升性能
    static readonly SUB_HEIGHT = 512
    
    private renderer: THREE.WebGLRenderer
    private multiViewTarget: THREE.WebGLRenderTarget  // 多视角纹理
    private composer: EffectComposer
    private interleavingPass: ShaderPass
    
    // 光栅参数
    private gratingParams = { slope: 0.1057, interval: 19.625, x0: 8.89 }
    
    // 40个相机位置偏移
    private cameraOffsets: number[] = []
    
    constructor() {
        // 计算每个视角的相机水平偏移
        const totalAngle = 40 * Math.PI / 180  // 40度总视角
        const focalDist = 100  // 焦平面距离
        const maxOffset = focalDist * Math.tan(totalAngle / 2)
        
        for (let i = 0; i < 40; i++) {
            const t = i / 39  // 0 到 1
            this.cameraOffsets[i] = maxOffset * (t * 2 - 1)  // -max 到 +max
        }
    }
    
    renderFrame(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
        const baseCamX = camera.position.x
        
        // Phase 1: 渲染40个视角到纹理图集
        for (let i = 0; i < 40; i++) {
            const col = i % 8
            const row = Math.floor(i / 8)
            
            // 偏移相机
            camera.position.x = baseCamX + this.cameraOffsets[i]
            camera.updateMatrixWorld()
            
            // 设置视口到子区域
            const vx = col * C1Renderer.SUB_WIDTH
            const vy = row * C1Renderer.SUB_HEIGHT
            this.renderer.setViewport(vx, vy, C1Renderer.SUB_WIDTH, C1Renderer.SUB_HEIGHT)
            this.renderer.setScissor(vx, vy, C1Renderer.SUB_WIDTH, C1Renderer.SUB_HEIGHT)
            this.renderer.setScissorTest(true)
            
            this.renderer.setRenderTarget(this.multiViewTarget)
            this.renderer.render(scene, camera)
        }
        
        // 还原相机
        camera.position.x = baseCamX
        
        // Phase 2: 交织后处理输出
        this.renderer.setRenderTarget(null)
        this.renderer.setScissorTest(false)
        this.renderer.setViewport(0, 0, C1Renderer.OUTPUT_WIDTH, C1Renderer.OUTPUT_HEIGHT)
        this.interleavingPass.uniforms.tDiffuse.value = this.multiViewTarget.texture
        this.composer.render()
    }
    
    updateGratingParams(params: DeviceParams) {
        this.gratingParams.slope = params.obliquity
        this.gratingParams.interval = params.lineNumber
        this.gratingParams.x0 = params.deviation
        this.interleavingPass.uniforms.slope.value = this.gratingParams.slope
        this.interleavingPass.uniforms.interval.value = this.gratingParams.interval
        this.interleavingPass.uniforms.x0.value = this.gratingParams.x0
    }
}
```

### 3.3 卷轴地图系统 (ScrollMap.ts)

```typescript
class ScrollMap {
    scrollSpeed: number = 2.0         // 每秒向下移动的基础速度
    totalDistance: number = 0          // 已滚动总距离
    bossInterval: number = 5000       // 每 5000 单位距离出现一个 Boss
    currentBiome: BiomeType = 'earth_plains'
    
    // 地貌主题列表（按Boss击杀数递进）
    static BIOME_SEQUENCE: BiomeType[] = [
        'earth_plains',       // Boss 0-1: 绿色平原、河流、城市
        'earth_desert',       // Boss 1-2: 沙漠、峡谷
        'earth_ocean',        // Boss 2-3: 海洋、岛屿
        'earth_volcanic',     // Boss 3-4: 火山、岩浆地貌
        'earth_ruins',        // Boss 4-5: 废墟、残酷地表
        'space_orbit',        // Boss 5-6: 低轨太空、卫星碎片
        'space_deep',         // Boss 6-7: 深空、星云
        'space_asteroid',     // Boss 7-8: 小行星带、破碎行星
        'space_blackhole',    // Boss 8-9: 黑洞附近、扭曲空间
        'space_final',        // Boss 9+:  最终决战区域
    ]
    
    update(dt: number) {
        this.totalDistance += this.scrollSpeed * dt * 60
        // 地形块管理：加载前方地形、卸载后方地形
    }
    
    getBossNumber(): number {
        return Math.floor(this.totalDistance / this.bossInterval)
    }
}
```

### 3.4 实体系统

#### 3.4.1 玩家飞机 (Player.ts)

```typescript
class Player extends Entity {
    lives: number = 5
    infiniteLives: boolean = false
    currentWeapon: WeaponType = 'shot'  // 'shot' | 'spread' | 'laser'
    weaponLevel: number = 1             // 1-5 升级
    invincibleTimer: number = 0         // 被击中后无敌时间
    
    // 移动参数
    moveSpeed: number = 8.0             // 每秒移动像素
    
    // 碰撞箱
    hitboxRadius: number = 3            // 判定点很小（弹幕游戏传统）
    grazeRadius: number = 20            // 擦弹判定范围
    
    // 3D模型
    model: THREE.Group                  // 飞机3D模型
    depth: number = 1.5                 // C1 景深（屏幕前方弹出）
}
```

#### 3.4.2 三种武器系统 (PlayerBullets.ts)

```typescript
// 1. 点射（Shot）- 高伤害直线射击
class ShotWeapon {
    fireRate: number = 0.08   // 秒/发
    bulletSpeed: number = 30
    damage: number = 10
    // Level 1: 单发, Level 2: 双发, Level 3: 三发, Level 4: 四发+追踪, Level 5: 五发+穿透
}

// 2. 散射（Spread）- 扇形散射
class SpreadWeapon {
    fireRate: number = 0.15
    bulletSpeed: number = 25
    damage: number = 5
    spreadAngle: number = 60  // 扇形角度
    // Level 1: 3发, Level 2: 5发, Level 3: 7发, Level 4: 9发+爆裂, Level 5: 12发环形
}

// 3. 激光（Laser）- 持续照射
class LaserWeapon {
    damagePerSecond: number = 50
    beamWidth: number = 5
    // Level 1: 单束, Level 2: 双束, Level 3: 宽束, Level 4: 追踪束, Level 5: 全屏束
}
```

#### 3.4.3 敌机类型 (EnemyTypes.ts)

```typescript
enum EnemyType {
    // 小型敌机
    Scout,          // 直线飞行，不开火
    Fighter,        // 直线飞行，偶尔射击
    Swooper,        // 弧形飞入飞出
    
    // 中型敌机
    Gunship,        // 停留并射击弹幕
    Bomber,         // 投放区域炸弹
    Carrier,        // 释放小型敌机
    
    // 大型敌机
    Cruiser,        // 大量HP，多管炮塔
    Battleship,     // 占据半屏，多阶段攻击
    
    // 特殊
    Asteroid,       // 不可摧毁的障碍物（太空关卡）
    SpaceMine,      // 接近爆炸
}
```

#### 3.4.4 Boss系统 (Boss.ts)

```typescript
class Boss extends Entity {
    maxHP: number
    currentHP: number
    phases: BossPhase[]          // 多阶段战斗
    currentPhase: number = 0
    
    // 每个Boss都是独特的科幻战舰
    // Boss 1: 地面防御要塞 - 多炮塔，阶段性暴露弱点
    // Boss 2: 沙漠巨蝎战车 - 机械蝎子，钳击攻击
    // Boss 3: 海上航母 - 释放舰载机波次
    // Boss 4: 火山巨龙机甲 - 火焰弹幕
    // Boss 5: 废墟守卫者 - 光束扫射
    // Boss 6: 轨道卫星武器 - 激光阵列
    // Boss 7: 星云战列舰 - 全屏弹幕
    // Boss 8: 行星碎裂者 - 引力攻击
    // Boss 9: 黑洞守护者 - 空间扭曲弹幕
    // Boss 10: 最终Boss - 融合所有攻击模式
}

interface BossPhase {
    hpThreshold: number    // 进入此阶段的HP百分比
    attackPatterns: AttackPattern[]
    vulnerablePoints: VulnerablePoint[]
}
```

### 3.5 弹幕系统 (EnemyBullets.ts)

```typescript
// 弹幕模式（Danmaku Patterns）
enum BulletPattern {
    Aimed,          // 自机狙（瞄准玩家）
    Ring,           // 环形弹幕（均匀圆形）
    Spiral,         // 螺旋弹幕
    Fan,            // 扇形弹幕
    Random,         // 随机散射
    Stream,         // 连续弹流
    Cross,          // 十字弹幕
    Curtain,        // 弹幕帘（大量平行子弹）
    Homing,         // 追踪弹（低速）
}

class BulletEmitter {
    pattern: BulletPattern
    bulletSpeed: number
    fireRate: number
    bulletCount: number      // 每次发射的子弹数
    angleSpread: number      // 角度范围
    rotationSpeed: number    // 旋转速度（用于螺旋等）
}
```

### 3.6 碰撞检测系统 (CollisionSystem.ts)

```typescript
class CollisionSystem {
    // 使用空间分区优化（网格法）
    private grid: SpatialGrid
    
    checkCollisions(entities: Entity[]) {
        // 1. 玩家子弹 vs 敌机/Boss
        // 2. 敌方子弹 vs 玩家（hitbox判定）
        // 3. 敌机 vs 玩家（碰撞判定）
        // 4. 玩家 vs 道具（拾取判定）
        // 5. 敌方子弹 vs 玩家擦弹范围（grazeRadius）
    }
    
    // 擦弹检测：子弹在 grazeRadius 内但不在 hitboxRadius 内
    checkGraze(player: Player, bullet: Bullet): boolean {
        const dist = distance(player.position, bullet.position)
        return dist <= player.grazeRadius && dist > player.hitboxRadius
    }
}
```

### 3.7 计分系统 (ScoreSystem.ts)

```typescript
class ScoreSystem {
    score: number = 0
    multiplier: number = 1.0
    grazeCount: number = 0
    killCombo: number = 0
    comboTimer: number = 0
    
    // 得分事件
    onEnemyKilled(enemy: Enemy) {
        const base = enemy.scoreValue
        this.score += base * this.multiplier
        this.killCombo++
        this.comboTimer = 2.0  // 2秒combo窗口
        if (this.killCombo % 10 === 0) this.multiplier += 0.1
    }
    
    onGraze() {
        this.grazeCount++
        this.score += 50 * this.multiplier  // 擦弹奖励
        // 连续擦弹额外奖励
    }
    
    onPowerUpCollected(powerUp: PowerUp) {
        this.score += powerUp.scoreValue * this.multiplier
    }
    
    onBossKilled(boss: Boss) {
        const timeBonus = Math.max(0, 30 - boss.fightDuration) * 1000
        this.score += boss.scoreValue + timeBonus
    }
}
```

### 3.8 道具系统 (PowerUp.ts)

```typescript
enum PowerUpType {
    WeaponUpgrade,    // 当前武器升级
    WeaponSwitch_Shot,    // 切换为点射
    WeaponSwitch_Spread,  // 切换为散射
    WeaponSwitch_Laser,   // 切换为激光
    ExtraLife,        // 额外生命
    Shield,           // 护盾（吸收一次伤害）
    Bomb,             // 全屏清弹
    ScoreGem_Small,   // 小分数宝石
    ScoreGem_Large,   // 大分数宝石
    SpeedUp,          // 临时加速
    Magnet,           // 吸附所有道具
}
```

### 3.9 难度递进系统 (DifficultyManager.ts)

```typescript
class DifficultyManager {
    // 基于卷轴距离的难度曲线
    getDifficulty(scrollDistance: number): DifficultyConfig {
        const t = scrollDistance / 50000  // 归一化到 0-1（完整流程约50000距离）
        
        return {
            enemySpawnRate: lerp(0.5, 3.0, t),      // 敌机生成频率
            enemyHP: lerp(1.0, 5.0, t),              // 敌机血量倍率
            bulletSpeed: lerp(1.0, 2.0, t),           // 子弹速度倍率
            bulletDensity: lerp(1.0, 4.0, t),         // 弹幕密度倍率
            eliteChance: lerp(0, 0.3, t),             // 精英敌机概率
            powerUpFrequency: lerp(1.0, 0.6, t),     // 道具频率（逐渐减少）
        }
    }
}
```

## 四、C1 3D 景深层设计

### 4.1 深度分层方案

游戏采用多层3D景深，充分利用C1裸眼3D效果：

```
 屏幕前方 (弹出)                          屏幕后方 (凹入)
     ←────────────────────────────────────────→
     
 +3cm    +2cm    +1cm    0cm    -1cm   -2cm   -3cm   -5cm
  │       │       │       │       │       │       │      │
  UI层  弹幕/    玩家    焦平面  敌机    中景    近景   远景
        爆炸    飞机    (基准)  编队    地形   地貌   天空/
        特效                                        太空
```

### 4.2 动态景深效果

- **Boss入场**：从远处（-5cm）缓慢推近到焦平面
- **爆炸效果**：碎片向前弹出（+2~+3cm）
- **激光武器**：光束贯穿多个深度层
- **弹幕**：不同深度的子弹产生前后交错的立体感
- **地形**：建筑物、山峰有高度差，利用景深增强立体感

## 五、卷轴地貌系统详细设计

### 5.1 地貌程序化生成

每个地貌主题包含：
- **地面基础层**：大面积地形网格（Terrain Mesh），程序化高度图
- **装饰物**：建筑、树木、岩石、陨石坑等3D对象
- **动态元素**：河流、岩浆流、星云、粒子效果
- **过渡效果**：击杀Boss后，地貌在约500距离单位内渐变到下一主题

### 5.2 各阶段主题详述

| 阶段 | 地貌 | 主要配色 | 装饰物 | 敌机风格 |
|------|------|---------|--------|---------|
| 1. 平原 | 绿色草地、河流、小城 | 绿/蓝/白 | 房屋、桥梁、树木 | 基础战斗机 |
| 2. 沙漠 | 黄沙、峡谷、古遗迹 | 黄/橙/棕 | 金字塔、废弃机械 | 沙漠机甲 |
| 3. 海洋 | 深蓝海面、岛屿、航母 | 蓝/白/灰 | 军舰、灯塔、浮台 | 海军舰载机 |
| 4. 火山 | 黑色岩石、岩浆河、火山 | 红/橙/黑 | 岩浆喷发、裂缝 | 耐热重甲机 |
| 5. 废墟 | 破碎城市、废铁堆 | 灰/暗红/锈色 | 倒塌建筑、铁丝网 | 改造机械 |
| 6. 近太空 | 大气层边缘、卫星 | 黑/蓝/金属色 | 太空站碎片、卫星 | 太空战斗机 |
| 7. 深空 | 星云、远星 | 紫/蓝/黑 | 星云粒子、星星 | 外星战舰 |
| 8. 小行星带 | 破碎行星、陨石 | 灰/棕/暗金 | 旋转陨石、碎片 | 矿业机甲 |
| 9. 黑洞 | 扭曲空间、吸积盘 | 黑/橙/白 | 引力透镜效果 | 维度战舰 |
| 10. 终局 | 融合所有元素 | 全彩光效 | 能量漩涡 | 最终舰队 |

## 六、输入系统设计

### 6.1 键盘控制方案

```typescript
// 默认键位映射
const DEFAULT_KEY_MAP = {
    moveUp:     'ArrowUp',       // 上移
    moveDown:   'ArrowDown',     // 下移
    moveLeft:   'ArrowLeft',     // 左移
    moveRight:  'ArrowRight',    // 右移
    fire:       'KeyZ',          // 射击（按住连射）
    bomb:       'KeyX',          // 炸弹（全屏清弹）
    focus:      'ShiftLeft',     // 低速移动（精确闪避）
    weaponNext: 'KeyC',          // 切换武器
    pause:      'Escape',        // 暂停
    
    // 备用方向键
    altUp:      'KeyW',
    altDown:    'KeyS',
    altLeft:    'KeyA',
    altRight:   'KeyD',
}
```

### 6.2 输入处理

```typescript
class InputManager {
    private keys: Map<string, boolean> = new Map()
    
    // 持续按住检测（移动/射击）
    isHeld(action: string): boolean
    
    // 单次按下检测（炸弹/暂停/切换武器）
    isJustPressed(action: string): boolean
    
    // 聚焦模式（按住Shift时降低移动速度，显示碰撞点）
    isFocusMode(): boolean
}
```

## 七、游戏状态流程

```
[启动] → [标题画面] → [设置/开始]
                          │
                     [游戏进行中] ←──── [复活]
                     │    │    │          │
                [暂停] [Boss战] [被击中] ──┘
                     │         │      │
                     │    [Boss击杀]  [Game Over]
                     │         │          │
                     │    [地貌过渡]  [排行榜/重开]
                     │         │
                     └─────────┘
```

## 八、性能优化策略

### 8.1 渲染优化
1. **视角数量自适应**：检测GPU性能，必要时降低到 20 或 10 个视角
2. **LOD系统**：远处地形使用低多边形模型
3. **实例化渲染**：大量相同敌机/子弹使用 InstancedMesh
4. **对象池**：子弹、爆炸效果等高频创建/销毁的对象使用对象池
5. **视锥剔除**：自动剔除屏幕外的对象

### 8.2 内存优化
1. **纹理图集**：多个小纹理合并为图集
2. **地形分块加载/卸载**：只保留屏幕前后一定范围的地形块
3. **子弹上限**：设置最大子弹数量（如1000发），超出后移除最早的子弹

### 8.3 帧率目标
- **逻辑更新**：固定 60 FPS
- **渲染帧率**：目标 30 FPS（40个视角渲染较重），最低 20 FPS
- 提供性能设置选项：低/中/高画质

## 九、配置系统

```typescript
interface GameConfig {
    // 游戏性
    initialLives: number         // 默认 5
    infiniteLivesMode: boolean   // 无限生命模式
    startingWeapon: WeaponType   // 初始武器
    difficulty: 'easy' | 'normal' | 'hard'
    
    // 显示
    c1Mode: boolean              // C1 3D模式开关
    viewCount: 40 | 20 | 10     // 视角数量（影响性能）
    targetFPS: 30 | 60           // 目标帧率
    showFPS: boolean             // 显示帧率
    showHitbox: boolean          // 显示碰撞框（调试用）
    
    // 音频
    masterVolume: number         // 0-1
    bgmVolume: number
    sfxVolume: number
    
    // 按键
    keyBindings: KeyMap
}
```
