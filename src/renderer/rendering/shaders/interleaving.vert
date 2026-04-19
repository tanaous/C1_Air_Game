/**
 * C1 裸眼3D交织着色器 — 顶点着色器
 * 参考自 CubeVi/3DMonitor 开源项目
 * 标准直通顶点着色器，将 UV 坐标传递给片段着色器
 */

varying vec2 vUV;

void main() {
    vUV = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
