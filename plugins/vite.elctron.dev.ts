// Electron 开发模式 Vite 插件
// 参考自 CubeVi/3DMonitor 开源项目，针对 Void Strike 游戏精简适配
import type { Plugin } from 'vite'
import type { AddressInfo } from 'net'
import { spawn } from 'child_process'
import fs from 'node:fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

export const viteElectronDev = (): Plugin => {
    return {
        name: 'vite-electron-dev',
        configureServer(server) {
            // 编译主进程
            const aliases = {
                '@shared': './src/shared',
                '@':       './src/renderer',
                '@main':   './src/main',
            }
            const buildMain = () => {
                require('esbuild').buildSync({
                    entryPoints: ['src/main/index.ts'],
                    bundle: true,
                    outfile: 'dist/background.js',
                    platform: 'node',
                    target: 'node18',
                    external: ['electron'],
                    alias: aliases,
                })
            }
            // 编译 preload 脚本
            const buildPreload = () => {
                require('esbuild').buildSync({
                    entryPoints: ['src/main/preload.ts'],
                    bundle: true,
                    outfile: 'dist/preload.js',
                    platform: 'node',
                    target: 'node18',
                    external: ['electron'],
                    alias: aliases,
                })
            }

            buildMain()
            buildPreload()

            server?.httpServer?.once('listening', () => {
                const addressInfo = server?.httpServer?.address() as AddressInfo
                const url = `http://localhost:${addressInfo.port}`

                let electronProcess = spawn(require('electron') as string, ['dist/background.js', url], {
                    stdio: 'inherit',
                })

                // 监听主进程变更，自动重启
                fs.watchFile('src/main/index.ts', () => {
                    electronProcess.kill()
                    buildMain()
                    buildPreload()
                    electronProcess = spawn(require('electron') as string, ['dist/background.js', url], {
                        stdio: 'inherit',
                    })
                })
            })
        },
    }
}
