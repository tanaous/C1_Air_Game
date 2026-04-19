// Electron 生产构建 Vite 插件
// 参考自 CubeVi/3DMonitor 开源项目，针对 Void Strike 游戏精简适配
import type { Plugin } from 'vite'
import * as electronBuilder from 'electron-builder'
import path from 'path'
import fs from 'fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

export const viteElectronBuild = (): Plugin => {
    return {
        name: 'vite-electron-build',
        closeBundle() {
            const aliases = {
                '@shared': './src/shared',
                '@':       './src/renderer',
                '@main':   './src/main',
            }
            // 编译主进程
            require('esbuild').buildSync({
                entryPoints: ['src/main/index.ts'],
                bundle: true,
                outfile: 'dist/background.js',
                platform: 'node',
                target: 'node18',
                external: ['electron'],
                minify: true,
                alias: aliases,
            })
            // 编译 preload
            require('esbuild').buildSync({
                entryPoints: ['src/main/preload.ts'],
                bundle: true,
                outfile: 'dist/preload.js',
                platform: 'node',
                target: 'node18',
                external: ['electron'],
                minify: true,
                alias: aliases,
            })

            // 修改 package.json main 字段
            const json = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
            json.main = 'background.js'
            fs.writeFileSync('dist/package.json', JSON.stringify(json, null, 2))

            // 创建空 node_modules 目录（electron-builder 需要）
            const nmDir = path.resolve(process.cwd(), 'dist/node_modules')
            if (!fs.existsSync(nmDir)) fs.mkdirSync(nmDir)

            // 使用 electron-builder 打包
            electronBuilder.build({
                config: {
                    appId: 'com.voidstrike.c1airgame',
                    productName: 'Void Strike',
                    directories: {
                        output: path.resolve(process.cwd(), 'release'),
                        app: path.resolve(process.cwd(), 'dist'),
                    },
                    asar: true,
                    nsis: {
                        oneClick: false,
                        perMachine: false,
                        allowElevation: true,
                        allowToChangeInstallationDirectory: true,
                        createDesktopShortcut: true,
                        createStartMenuShortcut: true,
                        shortcutName: 'Void Strike',
                        installerLanguages: 'zh-CN',
                    },
                    win: {
                        icon: 'public/icon.png',
                        target: [{ target: 'nsis', arch: ['x64'] }],
                    },
                    extraResources: [{ from: 'public/', to: 'public/' }],
                },
            })
        },
    }
}
