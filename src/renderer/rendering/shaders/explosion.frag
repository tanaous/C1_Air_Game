/**
 * 爆炸效果着色器
 * 用于粒子爆炸的发光渲染
 */

#ifdef GL_ES
precision highp float;
#endif

varying vec2 vUV;

uniform float progress;    // 爆炸进度（0.0=开始, 1.0=结束/消散）
uniform vec3 coreColor;    // 核心颜色（如白/黄）
uniform vec3 outerColor;   // 外缘颜色（如橙/红）

void main(void) {
    vec2 center = vUV - 0.5;
    float dist = length(center);

    // 爆炸扩散：随进度向外扩展
    float ring = exp(-pow(dist - progress * 0.5, 2.0) * 30.0);
    // 核心消散
    float core = exp(-dist * dist * 20.0) * (1.0 - progress);

    // 颜色混合：核心白热→外缘橙红
    vec3 color = mix(coreColor, outerColor, dist * 2.0 + progress);
    float brightness = (ring + core) * (1.0 - progress * 0.8);

    gl_FragColor = vec4(color * brightness, brightness * 0.9);
}
