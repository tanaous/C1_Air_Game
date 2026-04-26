# C1 裸眼 3D 最小原型验证结论

> 验证日期：2026-04-26  
> 验证设备：中国区 OpenstageAI / C1，设备编号 `ZX1393`  
> 原型目录：`prototypes/c1-pbr-box/`

## 结论摘要

本次使用一个完全独立的 PBR 立方体原型验证了 C1 裸眼 3D 技术路线。最理想组合如下：

```text
projection:   three-converged
viewOrder:    reversed
atlasColumns: official straight
atlasRows:    official top-first
parallax:     1.00
mode:         interleaved
```

用户在 C1 显示器上确认：该组合立体感最理想。`viewOrder=official` 会更模糊，可视角度也更小。`parallax` 的当前调节范围可用，最大值效果突出但不会破坏画面，`1.00` 建议作为默认值，并保留精细调节能力。

## 验证时设备参数

这些参数必须运行时从国内区 OpenstageAI 在线获取，不允许使用固定 fallback 判断 3D 效果。

```text
pipe:      OpenstageAI_server_pipe
deviceId:  ZX1393
slope:     0.10490
interval:  19.62330
x0:        4.34709
display:   OPC-0157-25
bounds:    1440x2560
physical:  1440x2560
scale:     1
```

硬要求：

- 未获取到 OpenstageAI 在线设备参数时，C1 模式应拒绝运行。
- 未找到物理 `1440x2560` 的 C1 显示器时，C1 模式应拒绝运行。
- 不要在普通显示器、浏览器窗口、或非物理满屏状态下判断裸眼 3D 是否正确。

## 已验证渲染参数

参考官方 Unity SDK 后，原型中验证的参数为：

```text
output:       1440x2560
views:        8x5 = 40
sub image:    540x960
atlas:        4320x4800
focalLength:  3806
fov:          14.38deg
theta:        40deg
```

注意：早期原型使用过 `450x800` 子图和 `floor(pixel)+1.0` 的 shader 坐标形式，不应迁移到主程序。Unity SDK 的 shader 采用连续坐标：

```glsl
float x = pos.x * outputWidth + 0.5;
float y = (1.0 - pos.y) * outputHeight + 0.5;
```

## 相机与视角顺序

主程序建议采用原型验证后的语义：

```text
projection = three-converged
viewOrder  = reversed
atlasCols  = official straight
atlasRows  = official top-first
parallax   = 1.00
```

解释：

- `three-converged` 是 Three.js 下的焦平面收敛写法，比直接照搬 Unity `lensShift` 更适合 Three.js。
- `viewOrder=reversed` 在实际 C1 上更清晰、可视角度更大，应作为主程序默认。
- `atlasColumns=official straight` 和 `atlasRows=official top-first` 保持官方图集写入习惯。
- `parallax=1.00` 是当前体验最平衡的默认值；建议 UI/调试中提供细粒度调节，例如 `0.05` 步进，范围保留当前原型的 `0.00 ~ 1.50`。

## 主程序迁移清单

修改主程序 C1 管线时优先做这些：

1. 将多视角 RenderTarget 改为 `4320x4800`，子视图 `540x960`。
2. 交织 shader 的屏幕坐标改为 `uv * outputSize + 0.5`，不要使用 `floor(...) + 1.0`。
3. C1 模式启动前强制获取 `OpenstageAI_server_pipe` 在线参数。
4. C1 模式启动前强制确认物理显示器为 `1440x2560`。
5. 默认视图顺序使用本次验证的 `reversed`。
6. 默认投影使用原型的 `three-converged` 逻辑。
7. 默认 `parallax=1.00`，并提供运行时精细调节。
8. 调试信息放到普通屏控制窗口，不要在 C1 交织画面上显示小字 HUD。
9. C1 输出窗口只负责全屏渲染最终交织画面。
10. 保留一个最小 PBR 立方体验证入口，作为以后回归 C1 管线的基准。

## 已知教训

- C1 不需要对游戏内容做特殊“伪 3D”设计；应先按普通 3D 游戏开发，最后接入 C1 多视角和交织输出。
- 截图只能看到交织输入图，不能判断人眼经过 C1 光栅后的效果；最终融合、深度方向、可视角度必须由人看 C1 显示器确认。
- C1 上显示文字非常不适合调试，控制和状态应放在普通显示器窗口。
- fallback 参数会制造误判。没有在线设备参数时，即使画面能渲染，也不能用于判断裸眼 3D。

## 参考来源

- 官方 Unity SDK：`https://github.com/CubeVi/CubeVi-Swizzle-Unity`
- 本项目官方参考：`reference/3DMonitor/src/view/viewer/shader.ts`
- 本项目最小验证原型：`prototypes/c1-pbr-box/`

