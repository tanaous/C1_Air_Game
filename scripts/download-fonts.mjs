/**
 * 字体下载脚本
 * 用法: node scripts/download-fonts.mjs
 *
 * 从 Google Fonts 下载游戏所需的开源字体（OFL 许可）：
 *   - Orbitron（主 UI 字体）
 *   - Share Tech Mono（数字显示字体）
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FONT_DIR = path.resolve(__dirname, '../src/renderer/assets/fonts')

if (!fs.existsSync(FONT_DIR)) fs.mkdirSync(FONT_DIR, { recursive: true })

// Google Fonts 字体 URL（woff2 格式，来自 Google CDN）
const FONTS = [
  {
    url: 'https://fonts.gstatic.com/s/orbitron/v31/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1nysimBoWgz.woff2',
    file: 'Orbitron-Regular.woff2',
  },
  {
    url: 'https://fonts.gstatic.com/s/orbitron/v31/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1nGsimBoWgz.woff2',
    file: 'Orbitron-Bold.woff2',
  },
  {
    url: 'https://fonts.gstatic.com/s/sharetechmono/v15/J7aHnp1uDWRBEqV98dVQztYldFcLowEF.woff2',
    file: 'ShareTechMono-Regular.woff2',
  },
]

function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      console.log(`  已存在: ${path.basename(dest)}`)
      resolve()
      return
    }
    const file = fs.createWriteStream(dest)
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close()
        fs.unlinkSync(dest)
        download(res.headers.location, dest).then(resolve).catch(reject)
        return
      }
      res.pipe(file)
      file.on('finish', () => {
        file.close()
        const size = fs.statSync(dest).size
        console.log(`  下载完成: ${path.basename(dest)} (${(size / 1024).toFixed(1)} KB)`)
        resolve()
      })
    }).on('error', (err) => {
      fs.unlink(dest, () => {})
      reject(err)
    })
  })
}

console.log('正在下载游戏字体...')
try {
  for (const font of FONTS) {
    await download(font.url, path.join(FONT_DIR, font.file))
  }
  console.log('\n✓ 字体下载完成！')
} catch (err) {
  console.error('\n字体下载失败（可在游戏中使用系统等宽字体降级）:', err.message)
  console.log('备用方案：游戏将使用系统 monospace 字体作为后备。')
}
