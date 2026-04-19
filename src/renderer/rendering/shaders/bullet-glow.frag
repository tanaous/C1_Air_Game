/**
 * 子弹/引擎发光效果着色器
 * 用于玩家子弹、引擎尾焰、道具等需要发光效果的物体
 */

#ifdef GL_ES
precision highp float;
#endif

varying vec2 vUV;
varying vec3 vPosition;

uniform vec3 glowColor;    // 发光颜色
uniform float intensity;   // 发光强度（0.0 ~ 5.0）
uniform float time;        // 当前时间（用于动态脉冲）
uniform float pulse;       // 脉冲幅度（0 = 不脉冲，1 = 全脉冲）

void main(void) {
    // 基于 UV 中心距离计算发光衰减（圆形发光）
    vec2 center = vUV - 0.5;
    float dist = length(center);

    // 软边缘发光（指数衰减）
    float glow = exp(-dist * dist * 8.0) * intensity;

    // 可选脉冲效果（用于能量武器/道具）
    float pulseFactor = 1.0 + pulse * sin(time * 8.0) * 0.3;
    glow *= pulseFactor;

    // 核心更亮（内核白色）
    float core = exp(-dist * dist * 40.0);
    vec3 finalColor = mix(glowColor, vec3(1.0), core * 0.8) * glow;

    // Alpha 由发光强度决定
    float alpha = clamp(glow, 0.0, 1.0);

    gl_FragColor = vec4(finalColor, alpha);
}
