import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { deepseekProxyPlugin } from './server/deepseekProxy.ts';

export default defineConfig(({ mode }) => ({
  // Vercel 与本地使用根路径；GitHub Actions 显式注入仓库子路径。
  base: mode === 'production' ? process.env.VITE_BASE_PATH || '/' : '/',
  plugins: [react(), deepseekProxyPlugin(mode)],
}));
