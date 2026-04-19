/**
 * Vue 3 渲染进程入口
 */

import { createApp } from 'vue'
import App from './App.vue'

// 导入字体
import './assets/fonts/fonts.css'

const app = createApp(App)
app.mount('#app')
