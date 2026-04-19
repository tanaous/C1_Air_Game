/**
 * 游戏数学工具函数
 */

import * as THREE from 'three'

/** 线性插值 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** 将值约束在 [min, max] 范围内 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** 角度转弧度 */
export function degToRad(deg: number): number {
  return deg * Math.PI / 180
}

/** 两点之间的距离（2D，用于碰撞检测） */
export function distance2D(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  return Math.sqrt(dx * dx + dy * dy)
}

/** 两 THREE.Vector3 之间的 2D 距离（忽略 Z 轴） */
export function distance2DV3(a: THREE.Vector3, b: THREE.Vector3): number {
  return distance2D(a.x, a.y, b.x, b.y)
}

/** 随机范围 [min, max] */
export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/** 随机整数 [min, max]（含两端） */
export function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1))
}

/** 随机选取数组元素 */
export function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** 判断概率（p 为 0~1 的概率值） */
export function chance(p: number): boolean {
  return Math.random() < p
}

/**
 * 根据 C1 景深值计算多视角相机偏移乘数
 * 参考：reference/3DMonitor/src/view/viewer/multilayer.ts
 * @param z 景深（厘米），正=前，负=后
 */
export function depthToMultiplier(z: number): number {
  const zk = -z / 50
  return 5.126 * zk / (1 + zk)
}

/**
 * 计算多视角渲染中第 i 个视角的相机 X 偏移
 * @param i 视角索引（0~39）
 * @param focalDist 焦平面距离
 * @param totalAngleDeg 总视角范围（度）
 */
export function viewCameraOffset(i: number, focalDist: number, totalAngleDeg: number): number {
  const maxOffset = focalDist * Math.tan(degToRad(totalAngleDeg / 2))
  const t = i / 39   // 0 ~ 1
  return maxOffset * (t * 2 - 1)  // -maxOffset ~ +maxOffset
}
