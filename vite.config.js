import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    uni(),
  ],
  // [关键修复] 告诉 Vite 不要预构建这两个库，避免语法转换错误
  optimizeDeps: {
    exclude: ['jspdf', 'html2canvas']
  }
});