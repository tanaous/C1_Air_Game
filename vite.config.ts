import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { viteElectronDev } from './plugins/vite.elctron.dev'
import { viteElectronBuild } from './plugins/vite.elctron.build'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    viteElectronDev(),
    viteElectronBuild(),
  ],
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@main': resolve(__dirname, 'src/main'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  // 将 .frag/.vert 着色器文件作为字符串导入
  assetsInclude: ['**/*.frag', '**/*.vert', '**/*.glsl'],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
})
