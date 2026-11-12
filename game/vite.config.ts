import { defineConfig } from 'vite';

// Configuration Vite — MathKombat (AGENTS.md §8)
//  - base './' : chemins relatifs (obligatoire pour les assets APK embarqués)
//  - __BUILD_MODE__ : "debug" (dev + build --mode debug) ou "release" (build)
//    → pilote le logger (no-op compilé en release, AGENTS.md §5)
export default defineConfig(({ command, mode }) => ({
  base: './',
  define: {
    __BUILD_MODE__: JSON.stringify(
      command === 'serve' ? 'debug' : mode === 'release' ? 'release' : 'debug'
    ),
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: mode !== 'release',
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
}));
