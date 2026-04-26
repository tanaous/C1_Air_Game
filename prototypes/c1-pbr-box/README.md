# C1 PBR Box Prototype

这是一个独立的 C1 裸眼 3D 技术验线原型，不引入主游戏代码和素材。画面只有一个普通 Three.js PBR 立方体自动旋转，最后一步再做 C1 多视角图集和官方交织 shader。

## 启动

先启动并登录中国区 OpenstageAI，然后连接 C1 显示器。

```powershell
npm --prefix prototypes/c1-pbr-box run dev
```

启动脚本会同时启动 Vite 和 Electron。Electron 会通过中国区 `OpenstageAI_server_pipe` 按官方流程在线获取当前设备的编号和光栅参数。获取失败时程序会拒绝运行，因为没有在线设备参数一定无法正确显示 C1 裸眼 3D。

拿到参数后，程序还必须找到物理分辨率为 `1440 x 2560` 的 C1 显示器，否则同样拒绝运行。这里不再 fallback 到普通屏，避免误判。

## 技术参数

- 命名管道：`OpenstageAI_server_pipe`
- 输出分辨率：`1440 x 2560`
- 多视角图集：`8 x 5 = 40` views
- 子图尺寸：`540 x 960`，图集总尺寸 `4320 x 4800`
- 光栅参数：运行时从 OpenstageAI 在线获取当前设备的 `deviceId / obliquity / lineNumber / deviation`
- 相机设置：按 Unity SDK 的 `focalPlane=10, theta=40deg, f_cam=3806, tanHalfHorizontalFov=0.071`

代码里有一组启动占位数值，只用于让 shader uniforms 有初始值；Electron 主进程拿不到在线参数时不会创建测试窗口。只有看到 `ONLINE DEVICE PARAMS` 和设备编号后，才是当前 C1 的有效校准参数。

## 快捷键

- `V`：切换投影/收敛公式：`three-converged -> unity-negative -> unity-positive -> none`
- `R`：反转视角顺序，用于排查深度方向是否相反
- `O`：切换图集列打包方向，用于排查视图顺序是否与官方 shader 匹配
- `Y`：切换图集行打包方向，用于排查 WebGL/Unity 纹理 Y 方向差异
- `[` / `]`：临时调小/调大视差强度
- `Space` / `D`：切换 `interleaved -> atlas -> single`
- `F`：显示/隐藏全屏边框校验
- `H`：隐藏/显示左上角 HUD

普通显示器上 `interleaved` 模式会看起来像彩色条纹，这是正常的；C1 上应该看到一个有空间深度的旋转 PBR 立方体。

## 人工协助调试流程

1. 保持 `mode=interleaved`，确认四边彩色边框刚好贴满 C1 四边；确认后按 `F` 隐藏边框。
2. 先只按 `V`，每切一次观察 2-3 秒，记录哪个 `projection=` 最容易融合。
3. 在最容易融合的投影下，按 `R` 判断深度方向是否变得正确。
4. 如果仍然无法融合，再分别按 `O` 和 `Y` 测图集列/行方向。
5. 只需要反馈 HUD 上这几项：`projection / viewOrder / atlasColumns / atlasRows / parallax`，以及看到的是“融合、有重影、左右反、深度反、完全散”。
