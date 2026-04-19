# C1 Air Game - 素材需求与描述文档

## 一、素材总体策略

由于本项目为个人/小团队项目，3D素材采用以下策略：

1. **程序化生成优先**：地形、粒子效果、简单几何体敌机优先使用代码生成
2. **低多边形风格（Low-Poly）**：统一采用低多边形科幻风格，降低建模复杂度，同时性能友好
3. **发光/霓虹效果**：通过着色器实现发光边缘和能量效果，弥补模型简单的不足
4. **Three.js 内建几何体组合**：大量使用 BoxGeometry、ConeGeometry、CylinderGeometry 等组合创建飞机/战舰

> **重要提示**：本游戏的3D模型全部通过代码（Three.js 几何体组合 + 自定义着色器）程序化生成，无需外部3D建模工具。这样既便于Claude Code直接实现，也保证了一致的视觉风格。

---

## 二、3D模型素材清单

### 2.1 玩家飞机

**总体风格**：紧凑的战斗机造型，发光引擎尾焰，科幻风格

```
模型名: player_ship
构建方式: Three.js 几何体组合
组件:
  - 主体: 扁平的锥形/箭头形（ConeGeometry + 缩放）
  - 机翼: 两侧三角形板（BufferGeometry 自定义）
  - 引擎: 圆柱体（CylinderGeometry），后部发光
  - 座舱: 半球形（SphereGeometry 半球），蓝色半透明
  - 尾焰: 粒子系统或锥形发光体
颜色方案: 银白主体 + 蓝色发光线条 + 橙色引擎光
大小: 约 30x40x10 游戏单位
多边形预算: <200三角面
```

### 2.2 敌机系列

所有敌机采用统一的科幻金属风格，通过颜色区分难度：

#### 小型敌机

```
模型名: enemy_scout
描述: 侦察机 - 简单三角形飞行器
构建: 单个ConeGeometry + 小翼
颜色: 暗红色金属
大小: 15x20x5
多边形: <50

模型名: enemy_fighter
描述: 战斗机 - 略大的双翼战斗机
构建: 菱形主体 + 两侧小翼 + 前置炮口
颜色: 暗绿色金属
大小: 20x25x8
多边形: <80

模型名: enemy_swooper
描述: 突袭机 - 弯曲的镰刀形
构建: 弧形BufferGeometry
颜色: 紫色 + 发光边缘
大小: 25x15x5
多边形: <60
```

#### 中型敌机

```
模型名: enemy_gunship
描述: 炮舰 - 六角形平台 + 旋转炮塔
构建: CylinderGeometry(6段) + 顶部炮塔组合
颜色: 深灰金属 + 红色炮口光
大小: 40x40x15
多边形: <150

模型名: enemy_bomber
描述: 轰炸机 - 笨重的方形运输机
构建: BoxGeometry组合 + 底部投弹口
颜色: 军绿色 + 黄色警示条
大小: 50x35x15
多边形: <120

模型名: enemy_carrier
描述: 载机 - 小型航母，释放子机
构建: 长条BoxGeometry + 甲板 + 弹射器
颜色: 深蓝灰色
大小: 60x30x12
多边形: <180
```

#### 大型敌机

```
模型名: enemy_cruiser
描述: 巡洋舰 - 大型战舰，多炮塔
构建: 长菱形主体 + 3-4个炮塔 + 发光引擎阵列
颜色: 银灰色 + 蓝色动力线
大小: 80x50x20
多边形: <300

模型名: enemy_battleship
描述: 战列舰 - 超大型，占半屏
构建: 复杂组合体 + 护盾发光 + 多层甲板
颜色: 黑色金属 + 红色能量线
大小: 120x80x30
多边形: <500
```

### 2.3 Boss系列

每个Boss都是独特的大型科幻战舰/机械体：

```
Boss 1: "要塞守卫" (Fortress Guardian)
  描述: 地面固定防御平台，四角有炮塔，中央核心暴露弱点
  构建: 大型BoxGeometry基座 + 4个旋转CylinderGeometry炮塔 + 中心发光球
  大小: 150x150x40
  阶段: 3阶段（外壳→炮塔→核心）

Boss 2: "沙暴蝎" (Sand Scorpion)
  描述: 机械蝎子战车，双钳+尾部激光炮
  构建: 椭圆主体 + 两个分节手臂(钳) + 弧形尾巴 + 激光发射器
  大小: 180x120x50
  阶段: 3阶段（全形态→断钳→暴走）

Boss 3: "深海霸王" (Ocean Overlord)
  描述: 巨型海上航母 + 潜艇混合体
  构建: 长条舰体 + 飞行甲板 + 舰岛 + 导弹发射架
  大小: 200x100x40
  阶段: 3阶段（舰载机→导弹→主炮）

Boss 4: "炎龙机甲" (Flame Dragon)
  描述: 龙形机械体，喷火+飞行
  构建: 蛇形分节身体 + 翅膀 + 龙头（火焰喷射器）
  大小: 120x200x60（展开翅膀时）
  阶段: 3阶段（飞行→着陆→喷火暴走）

Boss 5: "废铁泰坦" (Ruin Titan)
  描述: 由废墟碎片拼接的巨型人形机器人
  构建: 各种BoxGeometry/CylinderGeometry不规则拼接 + 光束武器手臂
  大小: 100x250x50
  阶段: 4阶段（完整→上半身→核心→自爆）

Boss 6: "轨道之眼" (Orbital Eye)
  描述: 环形卫星武器平台，中央巨大能量球
  构建: TorusGeometry环 + 中央SphereGeometry + 6个挂载武器节点
  大小: 180x180x40
  阶段: 3阶段（旋转射击→充能→全屏激光）

Boss 7: "星云幻影" (Nebula Phantom)
  描述: 半透明、不断变形的能量体战舰
  构建: 大型半透明Geometry + 粒子云 + 内部核心
  大小: 变化（100-200）
  阶段: 3阶段（实体→分裂→合并暴走）

Boss 8: "碎星者" (Planet Breaker)
  描述: 超巨型采矿/毁灭战舰，前端有行星碎裂钻头
  构建: 巨大锥形钻头 + 长条工业舰体 + 侧面采矿臂
  大小: 150x300x80
  阶段: 4阶段（钻头攻击→侧面炮击→碎片弹幕→核心暴露）

Boss 9: "虚空使者" (Void Herald)
  描述: 扭曲空间的维度战舰，部分结构似乎存在于另一个维度
  构建: 克莱因瓶般的扭曲几何体 + 空间裂缝效果（着色器）
  大小: 200x200x100
  阶段: 3阶段（空间折叠攻击→维度裂缝→全维度弹幕）

Boss 10: "终极执政官" (Final Archon)
  描述: 最终Boss，融合了所有前Boss的元素
  构建: 超大型多阶段变形战舰
  大小: 250x300x100
  阶段: 5阶段（常规→融合→狂暴→绝望→最终形态）
```

### 2.4 子弹模型

```
player_bullet_shot:     小型发光圆柱体，蓝色
player_bullet_spread:   小型发光球体，绿色
player_laser:           长条矩形发光体，蓝白渐变
enemy_bullet_small:     小型发光球体，红色/橙色
enemy_bullet_large:     大型发光球体，深红色
enemy_bullet_homing:    带尾迹的三角形，紫色
boss_bullet_special:    异形发光体，各Boss独特颜色
```

### 2.5 道具模型

```
powerup_weapon:     旋转的武器图标胶囊（颜色区分类型）
powerup_life:       旋转的心形或飞机图标，金色
powerup_shield:     旋转的六角盾形，蓝色半透明
powerup_bomb:       旋转的炸弹图标，黄色
powerup_gem_small:  小型旋转菱形，绿色发光
powerup_gem_large:  大型旋转菱形，金色发光
powerup_speed:      闪电形状，黄色
powerup_magnet:     U形磁铁，红蓝配色
```

### 2.6 爆炸效果

```
所有爆炸效果使用粒子系统 (ParticleSystem) 程序化生成：

explosion_small:    小型爆炸，10-20个粒子，黄/橙色，持续0.3秒
explosion_medium:   中型爆炸，30-50个粒子，橙/红色，持续0.5秒
explosion_large:    大型爆炸（Boss阶段），100+粒子，多色，持续1.5秒
explosion_boss:     Boss最终爆炸，200+粒子+闪白屏效果，持续3秒
hit_spark:          命中火花，5-10个粒子，白/黄色，持续0.1秒
graze_effect:       擦弹效果，环形粒子波纹，蓝/白色，持续0.2秒
```

## 三、地形素材

### 3.1 程序化地形方案

所有地形通过程序化生成，不使用外部模型：

```typescript
// 地形生成方式
class TerrainGenerator {
    // 使用 Simplex Noise / Perlin Noise 生成高度图
    // 每个地形块 (TerrainChunk) 为一个 PlaneGeometry + 高度位移
    
    // 地形块尺寸
    static CHUNK_WIDTH = 200   // 游戏单位
    static CHUNK_HEIGHT = 200
    static SEGMENTS = 32       // 细分数
    
    generateChunk(biome: BiomeType, seed: number): TerrainChunk {
        const geometry = new THREE.PlaneGeometry(
            CHUNK_WIDTH, CHUNK_HEIGHT, SEGMENTS, SEGMENTS
        )
        // 根据biome类型应用不同的噪声参数和颜色
        this.applyHeightMap(geometry, biome, seed)
        this.applyColors(geometry, biome)
        return new TerrainChunk(geometry)
    }
}
```

### 3.2 各地貌的地形特征

```
earth_plains:    低起伏，绿色/棕色顶点颜色，河流为蓝色凹陷
earth_desert:    中起伏沙丘形状，黄/橙色，深峡谷
earth_ocean:     近乎平坦，蓝色半透明水面 + 偶尔凸起的岛屿（绿色）
earth_volcanic:  尖锐高起伏，黑色/红色，发光的岩浆裂缝（emissive）
earth_ruins:     碎裂的平坦地形，灰色，散布box形建筑废墟
space_orbit:     无地形，改为星空背景粒子 + 飘浮的太空站碎片
space_deep:      无地形，星云粒子云（体积雾效果模拟）
space_asteroid:  飘浮的不规则多面体（IcosahedronGeometry变形）
space_blackhole: 中心引力透镜效果（着色器失真），吸积盘环
space_final:     以上元素混合 + 能量漩涡效果
```

### 3.3 地形装饰物

全部使用简单几何体组合：

```
building_simple:     BoxGeometry 组合，城市建筑
tree_low:            ConeGeometry + CylinderGeometry（树）
bridge:              BoxGeometry 长条（桥梁）
pyramid:             ConeGeometry(4段)（金字塔）
volcano:             ConeGeometry + 顶部凹陷
lighthouse:          CylinderGeometry + 顶部SphereGeometry发光
space_station:       多个BoxGeometry/CylinderGeometry组合
asteroid_chunk:      IcosahedronGeometry + 顶点扰动
satellite:           BoxGeometry面板 + CylinderGeometry杆
space_debris:        随机BoxGeometry碎片组
```

## 四、UI素材

### 4.1 HUD元素（HTML/CSS覆盖层）

HUD使用HTML/CSS overlay，不走3D渲染管线，避免增加渲染负担：

```
生命显示:     小飞机图标 x 剩余生命数（CSS sprite或SVG）
分数显示:     右上角数字，使用等宽科幻字体
武器指示:     当前武器图标 + 等级条
Combo计数:    连杀数字 + 倍率显示
Boss血条:     屏幕顶部长条（Boss战时显示）
警告文字:     "WARNING" 闪烁文字（Boss即将出现）
```

### 4.2 字体

```
主字体: 使用系统等宽字体或嵌入开源科幻字体
推荐: "Orbitron"（Google Fonts, OFL许可）
     "Share Tech Mono"（Google Fonts, OFL许可）
备选: CSS @font-face 加载，或直接用 monospace 系统字体
```

### 4.3 标题画面

```
标题: 大号3D文字效果 "VOID STRIKE"（CSS文字阴影/渐变模拟）
副标题: "A CubeVi C1 Exclusive"
菜单项: START / SETTINGS / HIGH SCORES
背景: 游戏场景的慢速自动滚动预览
```

## 五、音频素材（可选，不影响核心开发）

音频为可选功能，首轮开发可忽略，后续添加：

```
BGM:
  title_bgm:       标题画面音乐（电子/合成器风格）
  stage_bgm_1-10:  各阶段背景音乐
  boss_bgm:        Boss战音乐（节奏加快）
  gameover_bgm:    游戏结束音乐

SFX:
  shot_fire:        点射发射音
  spread_fire:      散射发射音
  laser_fire:       激光持续音
  enemy_hit:        敌机被击中
  enemy_destroy:    敌机爆炸
  boss_destroy:     Boss爆炸（大型）
  player_hit:       玩家被击中
  player_death:     玩家爆炸
  powerup_collect:  拾取道具
  graze:            擦弹音效
  bomb_use:         炸弹释放
  menu_select:      菜单选择
  menu_confirm:     菜单确认
```

来源建议：使用 Web Audio API 程序化生成简单音效，或使用 CC0 开源音效。

## 六、着色器素材（GLSL代码）

以下自定义着色器需要编写：

```
interleaving.frag/vert:     C1光栅交织着色器（核心，参考3DMonitor）
glow.frag:                  发光/光晕效果（子弹、引擎、UI元素）
shield.frag:                护盾半透明脉冲效果
lava.frag:                  岩浆流动效果（火山地貌）
water.frag:                 水面波纹效果（海洋地貌）
nebula.frag:                星云体积效果
blackhole.frag:             黑洞引力透镜变形
explosion.frag:             爆炸光球效果
laser_beam.frag:            激光光束效果
warning_flash.frag:         Boss警告闪烁
```

## 七、素材生成优先级

### Phase 1 - 最小可玩版本（MVP）
1. 玩家飞机模型（几何体组合）
2. 3种小型敌机模型
3. 子弹（发光球/柱体）
4. 简单地形（PlaneGeometry + 颜色）
5. C1交织着色器
6. 基础HUD
7. 爆炸粒子效果

### Phase 2 - 核心体验
8. 中型/大型敌机
9. Boss 1-3 模型
10. 完善地貌 1-5（地表阶段）
11. 道具模型
12. 发光着色器效果
13. 完善UI

### Phase 3 - 完整游戏
14. Boss 4-10 模型
15. 太空阶段地貌 6-10
16. 特效着色器（黑洞、星云等）
17. 音频（可选）
18. 标题画面和完整菜单
