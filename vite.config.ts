import { defineConfig } from 'vite';

// User site (fengkailiu.github.io) is served from the domain root, so base stays '/'.
export default defineConfig({
  base: '/',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
