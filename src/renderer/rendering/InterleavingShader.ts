/**
 * C1 光栅交织着色器封装
 * 参考自 CubeVi/3DMonitor 开源项目（MIT 许可）
 *
 * 将 GLSL 着色器代码封装为 Three.js ShaderPass 可用的格式
 */

import type * as THREE from 'three'
import type { DeviceParams } from '@shared/types'
import { DEFAULT_GRATING_PARAMS } from '@/game/GameConfig'

// 顶点着色器（直通）
const vertexShader = /* glsl */`
  varying vec2 vUV;
  void main() {
    vUV = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// 片段着色器（C1 光栅交织核心）
// 参考：reference/3DMonitor/src/view/viewer/shader.ts
const fragmentShader = /* glsl */`
  #ifdef GL_ES
  precision highp float;
  #endif

  varying vec2 vUV;
  uniform sampler2D tDiffuse;   // 多视角纹理图集
  uniform float slope;           // 光栅参数：倾斜角正切值
  uniform float interval;        // 光栅参数：透镜间距
  uniform float x0;              // 光栅参数：水平偏移

  // C1 固定参数
  float row_img_num = 8.0;
  float col_img_num = 5.0;
  float num_of_view = 40.0;
  float gridSizeX   = 1440.0;
  float gridSizeY   = 2560.0;

  /**
   * 计算当前像素应从纹理图集中的哪个位置采样
   * bias: 0=R, 1=G, 2=B（对应 LCD 子像素物理偏移）
   */
  vec2 get_choice(vec2 pos, float bias) {
    float x = floor(pos.x * gridSizeX) + 1.0;
    float y = floor((1.0 - pos.y) * gridSizeY) + 1.0;

    float x1 = (x + y * slope) * 3.0 + bias;
    float x_local = mod(x1 + x0, interval);

    int choice = int(floor((x_local / interval) * num_of_view));

    vec2 choice_vec = vec2(
      row_img_num - mod(float(choice), row_img_num) - 1.0,
      floor(float(choice) / row_img_num)
    );

    vec2 reciprocals = vec2(1.0 / row_img_num, 1.0 / col_img_num);
    return (choice_vec.xy + pos) * reciprocals;
  }

  vec4 get_color(float bias) {
    return texture2D(tDiffuse, get_choice(vUV, bias));
  }

  void main(void) {
    // RGB 三通道独立采样
    vec4 color;
    color.r = get_color(0.0).r;
    color.g = get_color(1.0).g;
    color.b = get_color(2.0).b;
    color.a = 1.0;
    gl_FragColor = color;
  }
`

/**
 * 为 Three.js ShaderPass 准备的着色器定义对象
 * 用法：
 *   const pass = new ShaderPass(InterleavingShaderDef)
 *   composer.addPass(pass)
 */
export const InterleavingShaderDef = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    slope:    { value: DEFAULT_GRATING_PARAMS.slope    as number },
    interval: { value: DEFAULT_GRATING_PARAMS.interval as number },
    x0:       { value: DEFAULT_GRATING_PARAMS.x0       as number },
  },
  vertexShader,
  fragmentShader,
}

/**
 * 更新着色器光栅参数
 * 在从 OpenstageAI 管道获取到新参数后调用
 */
export function updateInterleavingUniforms(
  uniforms: typeof InterleavingShaderDef.uniforms,
  params: DeviceParams
): void {
  uniforms.slope.value    = params.obliquity
  uniforms.interval.value = params.lineNumber
  uniforms.x0.value       = params.deviation
}

/**
 * 景深乘数计算（multilayer_z_multiply）
 * 参考：reference/3DMonitor/src/view/viewer/multilayer.ts
 *
 * @param z 景深值（厘米），正=屏幕前方弹出，负=屏幕后方凹入
 * @returns 着色器中使用的景深乘数
 */
export function calcDepthMultiplier(z: number): number {
  const zk = -z / 50
  return 5.126 * zk / (1 + zk)
}
