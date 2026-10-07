import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    host: true,
    open: false
  },
  publicDir: 'assets',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'build-assets'
  }
});
