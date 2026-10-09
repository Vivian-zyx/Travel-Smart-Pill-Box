import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  // 普通静态托管使用根路径；GitHub Actions 显式注入仓库子路径。
  base: mode === 'production' ? process.env.VITE_BASE_PATH || '/' : '/',
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        assetFileNames: (assetInfo) => assetInfo.name?.endsWith('.wasm')
          ? 'assets/[name][extname]'
          : 'assets/[name]-[hash][extname]',
      },
    },
  },
}));
