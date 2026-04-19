/**
 * C1 裸眼3D交织着色器 — 片段着色器
 * 参考自 CubeVi/3DMonitor 开源项目（MIT 许可）
 *
 * 工作原理：
 *   对于输出画面上的每一个像素 (x, y)，根据光栅参数
 *   (slope / interval / x0) 计算该像素应该显示哪个子视角的内容。
 *   RGB 三个子像素分别用 bias=0/1/2 独立寻址，
 *   以匹配 LCD 面板中 R/G/B 子像素的物理水平偏移。
 *
 * 核心公式：
 *   x1       = (x + y * slope) * 3.0 + bias
 *   x_local  = mod(x1 + x0, interval)
 *   choice   = floor((x_local / interval) * num_of_view)
 *   col      = row_img_num - (choice % row_img_num) - 1   // 列（反转）
 *   row      = floor(choice / row_img_num)
 *   UV       = (vec2(col, row) + vUV) * vec2(1/cols, 1/rows)
 */

#ifdef GL_ES
precision highp float;
#endif

varying vec2 vUV;

uniform sampler2D tDiffuse;   // 多视角纹理图集（40个子视角拼合）
uniform float slope;           // 光栅参数：柱透镜倾斜角正切值
uniform float interval;        // 光栅参数：柱透镜间距（亚像素单位）
uniform float x0;              // 光栅参数：水平起始偏移

// C1 显示器固定参数
float row_img_num = 8.0;       // 水平视角数
float col_img_num = 5.0;       // 垂直视角数
float num_of_view = 40.0;      // 总视角数 (8 × 5)
float gridSizeX   = 1440.0;    // C1 输出宽度（物理像素）
float gridSizeY   = 2560.0;    // C1 输出高度（物理像素）

/**
 * 根据屏幕坐标 pos 和子像素偏移 bias，返回纹理图集中的 UV 坐标
 * bias: 0=R, 1=G, 2=B
 */
vec2 get_choice(vec2 pos, float bias) {
    // 转换为像素坐标（中心偏移）
    float x = floor(pos.x * gridSizeX) + 1.0;
    float y = floor((1.0 - pos.y) * gridSizeY) + 1.0;

    // 根据光栅几何关系计算局部坐标
    float x1 = (x + y * slope) * 3.0 + bias;
    float x_local = mod(x1 + x0, interval);

    // 确定选择哪个子视角
    int choice = int(floor((x_local / interval) * num_of_view));

    // 计算该视角在图集中的行列位置（列反转以匹配左→右排列）
    vec2 choice_vec = vec2(
        row_img_num - mod(float(choice), row_img_num) - 1.0,  // 列索引
        floor(float(choice) / row_img_num)                      // 行索引
    );

    // 转换为 0~1 范围的纹理 UV
    vec2 reciprocals = vec2(1.0 / row_img_num, 1.0 / col_img_num);
    return (choice_vec.xy + pos) * reciprocals;
}

/**
 * 采样指定 bias 通道的颜色
 */
vec4 get_color(float bias) {
    vec2 uv = get_choice(vUV, bias);
    return texture2D(tDiffuse, uv);
}

void main(void) {
    // RGB 三通道分别用不同 bias 独立采样（对应 LCD 子像素物理偏移）
    vec4 color;
    color.r = get_color(0.0).r;  // R 通道: bias=0
    color.g = get_color(1.0).g;  // G 通道: bias=1
    color.b = get_color(2.0).b;  // B 通道: bias=2
    color.a = 1.0;
    gl_FragColor = color;
}
