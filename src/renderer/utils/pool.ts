/**
 * 对象池（Object Pool）
 * 用于子弹、爆炸效果等高频创建/销毁的对象，避免 GC 压力
 */

export interface Poolable {
  active: boolean
  reset(): void
}

export class ObjectPool<T extends Poolable> {
  private pool: T[] = []
  private factory: () => T
  private maxSize: number

  /**
   * @param factory 创建新对象的工厂函数
   * @param initialSize 预分配对象数量
   * @param maxSize 最大对象数（超出时返回 null）
   */
  constructor(factory: () => T, initialSize: number = 20, maxSize: number = 500) {
    this.factory = factory
    this.maxSize = maxSize

    // 预分配
    for (let i = 0; i < initialSize; i++) {
      const obj = factory()
      obj.active = false
      this.pool.push(obj)
    }
  }

  /** 从池中取出一个对象（没有空闲则创建新的，达到上限返回 null）*/
  acquire(): T | null {
    const inactive = this.pool.find(obj => !obj.active)
    if (inactive) {
      inactive.active = true
      inactive.reset()
      return inactive
    }

    if (this.pool.length < this.maxSize) {
      const obj = this.factory()
      obj.active = true
      obj.reset()
      this.pool.push(obj)
      return obj
    }

    // 达到上限
    return null
  }

  /** 归还对象到池 */
  release(obj: T): void {
    obj.active = false
  }

  /** 归还所有活跃对象 */
  releaseAll(): void {
    for (const obj of this.pool) {
      obj.active = false
    }
  }

  /** 获取当前活跃对象数量 */
  get activeCount(): number {
    return this.pool.filter(obj => obj.active).length
  }

  /** 获取池总大小 */
  get size(): number {
    return this.pool.length
  }
}
