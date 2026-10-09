import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { deepseekProxyPlugin } from './server/deepseekProxy.ts';

export default defineConfig(({ mode }) => ({
  // GitHub Pages 将站点部署在仓库子路径下；开发环境仍从根路径运行。
  base: mode === 'production' ? '/Travel-Smart-Pill-Box/' : '/',
  plugins: [react(), deepseekProxyPlugin(mode)],
}));
