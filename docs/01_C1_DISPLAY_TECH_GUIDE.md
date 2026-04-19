# C1 裸眼3D显示屏技术要点指南

> 本文档从 CubeVi/3DMonitor 开源项目中提炼，供开发C1专属游戏时参考。

## 一、C1 显示屏硬件概述

C1 是 CubeVi 出品的裸眼全息3D显示器，使用**柱透镜阵列（Lenticular Lens Array）**将不同视角的图像分别导向观看者的左右眼，从而在不需要任何眼镜的情况下产生立体深度效果。

- **屏幕物理分辨率**：1440 x 2560（竖屏）
- **多视角渲染网格**：8列 x 5行 = 40个视角
- **单视角子图尺寸**：每个子视角渲染为 288 x 512 像素（可根据性能调整为 180x320 等）
- **合成纹理总尺寸**：8 x 288 = 2304 宽, 5 x 512 = 2560 高 → 实际拼图纹理 2304x2560

## 二、三大光栅参数（Grating Parameters）

C1 3D效果的核心依赖三个校准参数，它们描述柱透镜网格相对于像素网格的几何关系：

| 参数 | 代码名 | 含义 | 典型值 |
|------|--------|------|--------|
| **X0** | `deviation` / `x0` | 柱透镜网格的水平起始偏移（亚像素单位），是最关键的校准值，逐台设备独立校准 | 8.89 |
| **Interval** | `lineNumber` / `interval` | 一个柱透镜的间距（亚像素宽度），即每个透镜柱覆盖多少输出像素 | 19.625 |
| **Slope** | `obliquity` / `slope` | 柱透镜阵列相对于像素网格的倾斜角度的正切值 | 0.1057 |

### 2.1 参数获取方式

这三个参数在运行时从 **Cubestage**（国际版）或 **OpenstageAI**（中文版）平台软件获取，通过 Windows 命名管道（Named Pipe）通信：

```typescript
// 管道路径
const pipeName = 'Cubestage_server_pipe'  // 或 'OpenstageAI_server_pipe'
const pipePath = '\\\\?\\pipe\\' + pipeName

// 连接并发送请求
const client = net.connect(pipePath)
client.write(JSON.stringify({
    id: 'inbuilt',
    app_id: APP_ID,
    app_key: APP_KEY,
    app_secret: APP_SECRET,
    app_version: ver,
    request_type: 'getDeivice'   // 注意：原始API中拼写如此
}))

// 接收响应
client.on('data', (d) => {
    const response = JSON.parse(d.toString())
    // 新版API格式
    if (response.request_type === 'getDeivice') {
        const config = response.response_data.config
        // config.deviation  → X0
        // config.lineNumber → Interval
        // config.obliquity  → Slope
    }
})
```

### 2.2 TypeScript 类型定义

```typescript
interface DeviceParams {
    obliquity: number   // Slope - 倾斜角正切值
    lineNumber: number  // Interval - 透镜间距
    deviation: number   // X0 - 水平偏移
}
```

## 三、多视角渲染原理（Multi-View Rendering）

### 3.1 核心概念

C1 显示3D内容的基本流程：

1. **渲染多个视角**：从略微不同的水平位置渲染同一场景的多个视角（40个视角，8x5网格排列）
2. **拼合为纹理图集**：将所有视角渲染结果拼合到一张大纹理上
3. **像素交织（Interleaving）**：通过后处理着色器，根据光栅参数将正确的视角像素映射到正确的屏幕像素位置

### 3.2 多视角相机配置

对于Three.js实现，需要设置多个相机，每个相机有微小的水平偏移：

```javascript
// 关键参数
const viewCount = 40           // 总视角数 (8x5)
const cols = 8                 // 水平视角数
const rows = 5                 // 垂直视角数（实际只用于网格排列）
const focalPlane = 100         // 焦平面距离
const theta = (40 / 180) * Math.PI  // 总视角范围 40度

// 对于每个视角 i (0..39)：
// col = i % 8, row = floor(i / 8)
// 水平偏移 = focalPlane * tan(theta/2) * (col / (cols-1) * 2 - 1)
```

### 3.3 渲染到纹理图集

每个视角渲染到大纹理的对应区域：

```javascript
// 纹理图集布局
const subWidth = 288   // 每个子视角宽度
const subHeight = 512  // 每个子视角高度
const atlasWidth = subWidth * cols    // 2304
const atlasHeight = subHeight * rows  // 2560

// 视角 i 在图集中的位置：
// x = (i % cols) * subWidth
// y = floor(i / cols) * subHeight
```

## 四、像素交织着色器（Interleaving Shader）— 最核心部分

### 4.1 着色器工作原理

对于输出画面上的每一个像素 (x, y)：
1. 根据 X0、Interval、Slope 计算该像素属于哪个透镜列
2. 确定该透镜列对应哪个子视角索引
3. 从该子视角中取出正确的颜色值

**关键：RGB三个子像素分别独立寻址**，各自使用不同的bias偏移（R=0, G=1, B=2），这是因为LCD的RGB子像素在物理上有水平偏移。

### 4.2 完整交织着色器（GLSL）

```glsl
#ifdef GL_ES
precision highp float;
#endif

varying vec2 vUV;
uniform sampler2D tDiffuse;     // 多视角纹理图集
uniform float slope;             // 光栅参数
uniform float interval;
uniform float x0;

float row_img_num = 8.0;        // 水平视角数
float col_img_num = 5.0;        // 垂直视角数
float num_of_view = 40.0;       // 总视角数
float gridSizeX = 1440.0;       // 输出宽度
float gridSizeY = 2560.0;       // 输出高度

// 核心函数：根据屏幕坐标计算视角选择（返回 0-1 的浮点数）
float get_choice_float(vec2 pos, float bias) {
    float x = floor(pos.x * gridSizeX) + 0.5;
    float y = floor((1.0 - pos.y) * gridSizeY) + 0.5;
    
    // 基于光栅几何计算局部坐标
    float x1 = (x + y * slope) * 3.0 + bias;
    float x_local = mod(x1 + x0, interval);
    
    return x_local / interval;
}

// 从视角选择值计算纹理图集中的UV坐标
vec2 get_uv_from_choice(vec2 pos, float choice_float) {
    int choice = int(floor(choice_float * num_of_view));
    
    vec2 choice_vec = vec2(
        8.0 - mod(float(choice), row_img_num) - 1.0,  // 列索引（反转）
        floor(float(choice) / row_img_num)              // 行索引
    );
    
    vec2 reciprocals = vec2(1.0 / row_img_num, 1.0 / col_img_num);
    vec2 uv = (choice_vec.xy + pos) * reciprocals;
    return uv;
}

void main(void) {
    // RGB 各通道独立采样，使用不同bias
    vec4 color;
    
    // Red channel - bias 0
    float choice_r = get_choice_float(vUV, 0.0);
    vec2 uv_r = get_uv_from_choice(vUV, choice_r);
    color.r = texture2D(tDiffuse, uv_r).r;
    
    // Green channel - bias 1
    float choice_g = get_choice_float(vUV, 1.0);
    vec2 uv_g = get_uv_from_choice(vUV, choice_g);
    color.g = texture2D(tDiffuse, uv_g).g;
    
    // Blue channel - bias 2
    float choice_b = get_choice_float(vUV, 2.0);
    vec2 uv_b = get_uv_from_choice(vUV, choice_b);
    color.b = texture2D(tDiffuse, uv_b).b;
    
    color.a = 1.0;
    gl_FragColor = color;
}
```

### 4.3 着色器关键公式解析

```
对于屏幕像素 (px, py)：
  x = floor(px * 1440) + 0.5
  y = floor((1 - py) * 2560) + 0.5
  
  x1 = (x + y * slope) * 3 + bias    // bias = 0/1/2 对应 R/G/B
  x_local = mod(x1 + x0, interval)
  
  choice = floor((x_local / interval) * 40)  // 选择第几个视角
  
  col = 7 - (choice % 8)    // 在8列中的位置（反转）
  row = floor(choice / 8)   // 在5行中的位置
  
  最终UV = ((col, row) + 原始UV) / (8, 5)
```

## 五、深度控制（景深/Depth Control）

### 5.1 深度视差原理

不同深度的物体通过水平偏移来产生视差效果。核心公式：

```typescript
// z 为深度值（厘米），正值为屏幕前方（弹出），负值为屏幕后方（凹进）
function multilayer_z_multiply(z: number): number {
    const zk = -z / 50
    return 5.126 * zk / (1 + zk)
}
```

### 5.2 深度偏移在着色器中的应用

```glsl
// 在着色器中，对于有深度的图层：
float view_angle = choice_float - 0.5;   // 归一化到 [-0.5, 0.5]
float x_offset = view_angle * z_k;        // z_k 是深度乘数
float x_rel = (vUV.x - x_offset - x_0) / (x_1 - x_0);
```

### 5.3 游戏中的深度层规划建议

| 层级 | 深度值(cm) | z_k值 | 用途 |
|------|-----------|-------|------|
| 背景层 | -5 ~ -3 | ~0.59~0.33 | 远景地貌、星空 |
| 中景层 | -2 ~ -1 | ~0.22~0.11 | 地面细节、建筑 |
| 游戏主层 | 0 | 0 | 焦平面，主要战斗区域 |
| 敌机层 | 0 ~ +1 | 0~-0.10 | 敌机和Boss |
| 玩家层 | +1 ~ +2 | -0.10~-0.19 | 玩家飞机 |
| UI/弹幕层 | +2 ~ +3 | -0.19~-0.27 | 子弹、爆炸特效、UI |

## 六、Electron 集成要点

### 6.1 双窗口架构

3DMonitor 使用双窗口模式：
- **主窗口（mainWindow）**：控制面板，显示在普通显示器上
- **动态窗口（dynamicWindow）**：3D内容渲染，全屏显示在C1显示器上

```typescript
// 检测 C1 显示器
function checkDisplay() {
    const all = screen.getAllDisplays()
    if (all.length > 1) {
        // 通过 labelList（从平台获取的显示器标签）匹配 C1
        let displays = all.filter(item => labelList.includes(item.label))
        if (displays.length === 0) {
            // 后备匹配方式
            displays = all.filter(item => item.label === 'TPV-2288-IN')
        }
        const dis = displays[0]?.workArea || all[1].workArea
        createDynamicWindow(dis.x, dis.y, dis.width, dis.height)
    }
}
```

### 6.2 C1 窗口配置

```typescript
dynamicWindow = new BrowserWindow({
    x: displayX,
    y: displayY,
    width: displayWidth,
    height: displayHeight,
    fullscreen: true,
    fullscreenable: true,
    frame: false,           // 无边框
    resizable: true,
    webPreferences: {
        nodeIntegration: true,
        webSecurity: false,
        backgroundThrottling: false,  // 防止后台降帧！关键
    }
})
dynamicWindow.setFullScreen(true)
dynamicWindow.maximize()
```

### 6.3 IPC 通信流程

```
Cubestage/OpenstageAI (Named Pipe)
         ↓
  Electron Main Process (background.ts)
         ↓ ipcMain → ipcRenderer
  Renderer Process (Vue组件)
         ↓
  WebGL Shader (光栅参数传入uniform)
```

## 七、Three.js 实现方案（推荐用于游戏）

参考项目中的 `viewer/index.vue` 使用 Three.js 实现：

```typescript
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

// 1. 创建场景和渲染器
const renderer = new THREE.WebGLRenderer()
renderer.setSize(1440, 2560)

// 2. 创建交织着色器Pass
const colorShader = {
    uniforms: {
        tDiffuse: { value: null },
        interval: { value: 19.625 },
        slope: { value: 0.1057 },
        x0: { value: 8.89 },
    },
    vertexShader: `
        varying vec2 vUV;
        void main() {
            vUV = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1);
        }
    `,
    fragmentShader: interleavingShaderCode,
}

// 3. 设置后处理管线
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const colorPass = new ShaderPass(colorShader)
composer.addPass(colorPass)

// 4. 运行时更新光栅参数
function updateGratingParams(params: DeviceParams) {
    colorPass.material.uniforms.slope.value = params.obliquity
    colorPass.material.uniforms.interval.value = params.lineNumber
    colorPass.material.uniforms.x0.value = params.deviation
}
```

## 八、游戏开发的特殊考量

### 8.1 性能优化
- 40个视角的渲染是性能瓶颈，需要**渲染到纹理图集**而非逐视角渲染
- 使用 `RenderTarget` 将所有视角渲染到一张大纹理
- 可以降低子视角分辨率以提升帧率（如 180x320 替代 288x512）
- 参考项目中 Babylon.js 实现的帧率限制：`targetFPS = 5`（监控场景），游戏需要更高帧率（30-60FPS）

### 8.2 多视角渲染策略（游戏专用）
对于实时3D游戏，推荐使用 **多相机偏移渲染** 方案：

```javascript
// 创建 8x5 = 40 个视角的 RenderTarget
const renderTarget = new THREE.WebGLRenderTarget(
    subWidth * 8,   // 2304
    subHeight * 5,  // 2560
    { format: THREE.RGBFormat }
)

// 每帧渲染40个视角
for (let i = 0; i < 40; i++) {
    const col = i % 8
    const row = Math.floor(i / 8)
    
    // 设置视口到对应子区域
    renderer.setViewport(col * subWidth, row * subHeight, subWidth, subHeight)
    renderer.setScissor(col * subWidth, row * subHeight, subWidth, subHeight)
    renderer.setScissorTest(true)
    
    // 偏移相机位置
    camera.position.x = baseX + horizontalOffset(i)
    camera.updateProjectionMatrix()
    
    // 渲染到纹理
    renderer.setRenderTarget(renderTarget)
    renderer.render(scene, camera)
}

// 最后用交织着色器输出到屏幕
renderer.setRenderTarget(null)
renderer.setScissorTest(false)
interleavingPass.uniforms.tDiffuse.value = renderTarget.texture
composer.render()
```

### 8.3 简化方案：双视角 + 深度层
如果40视角性能不够，可以使用**双视角+深度图**的简化方案（不推荐但可作为后备）。

## 九、参考文件索引

| 文件路径 | 内容 |
|---------|------|
| `reference/3DMonitor/src/view/viewer/shader.ts` | 交织着色器模板和 EffectShader 类 |
| `reference/3DMonitor/src/view/viewer/multilayer.ts` | Babylon.js 多层深度着色器 |
| `reference/3DMonitor/src/view/viewer/config.ts` | 显示参数配置常量 |
| `reference/3DMonitor/src/view/viewer/index.vue` | Three.js 渲染实现 |
| `reference/3DMonitor/src/view/viewer/index_babylon.vue` | Babylon.js 渲染实现 |
| `reference/3DMonitor/src/background.ts` | Electron主进程，含命名管道通信 |
| `reference/3DMonitor/src/preload.ts` | IPC API 暴露 |
| `reference/3DMonitor/src/view/viewer/type.ts` | DeviceParams 类型定义 |
