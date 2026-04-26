import type * as THREE from 'three'
import type { DeviceParams } from '@shared/types'
import { DEFAULT_GRATING_PARAMS } from '@/game/GameConfig'

const vertexShader = /* glsl */`
  varying vec2 vUV;

  void main() {
    vUV = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const fragmentShader = /* glsl */`
  precision highp float;

  varying vec2 vUV;
  uniform sampler2D tDiffuse;
  uniform float slope;
  uniform float interval;
  uniform float x0;

  const float row_img_num = 8.0;
  const float col_img_num = 5.0;
  const float num_of_view = 40.0;
  const float gridSizeX = 1440.0;
  const float gridSizeY = 2560.0;

  vec2 get_choice(vec2 pos, float bias) {
    float x = floor(pos.x * gridSizeX) + 0.5;
    float y = floor((1.0 - pos.y) * gridSizeY) + 0.5;
    float x1 = (x + y * slope) * 3.0 + bias;
    float x_local = mod(x1 + x0, interval);
    float choice = floor((x_local / interval) * num_of_view);

    vec2 choice_vec = vec2(
      row_img_num - mod(choice, row_img_num) - 1.0,
      floor(choice / row_img_num)
    );

    vec2 reciprocals = vec2(1.0 / row_img_num, 1.0 / col_img_num);
    return (choice_vec + pos) * reciprocals;
  }

  vec4 get_color(float bias) {
    return texture2D(tDiffuse, get_choice(vUV, bias));
  }

  void main(void) {
    vec4 color;
    color.r = get_color(0.0).r;
    color.g = get_color(1.0).g;
    color.b = get_color(2.0).b;
    color.a = 1.0;
    gl_FragColor = color;
  }
`

export const InterleavingShaderDef = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    slope: { value: DEFAULT_GRATING_PARAMS.slope as number },
    interval: { value: DEFAULT_GRATING_PARAMS.interval as number },
    x0: { value: DEFAULT_GRATING_PARAMS.x0 as number },
  },
  vertexShader,
  fragmentShader,
}

export function updateInterleavingUniforms(
  uniforms: typeof InterleavingShaderDef.uniforms,
  params: DeviceParams,
): void {
  const slope = Number(params.obliquity)
  const interval = Number(params.lineNumber)
  const x0 = Number(params.deviation)

  if (!Number.isFinite(slope) || !Number.isFinite(interval) || interval <= 0 || !Number.isFinite(x0)) return

  uniforms.slope.value = slope
  uniforms.interval.value = interval
  uniforms.x0.value = x0
}

export function calcDepthMultiplier(z: number): number {
  const zk = -z / 50
  return 5.126 * zk / (1 + zk)
}
