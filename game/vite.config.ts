import { defineConfig } from 'vite';

// Node env du build (le projet n'embarque pas @types/node)
declare const process: { env: Record<string, string | undefined> };

// Configuration Vite — MathKombat (AGENTS.md §8)
//  - base './' : chemins relatifs (obligatoire pour les assets APK embarqués)
//  - __BUILD_MODE__ : "debug" (dev + build --mode debug) ou "release" (build)
//    → pilote le logger (no-op compilé en release, AGENTS.md §5)
//  - __MK_VERSION__ : version du produit (MK_VERSION, source de vérité = tag git
//    v*, résolu par scripts/env.sh) — cohérente avec versionName de l'APK
export default defineConfig(({ command, mode }) => ({
  base: './',
  // game/assets/ = dossier unique des assets (AGENTS §4) : servi à la racine en
  // dev et copié dans dist/ à la build (APK) — une seule source pour les images.
  publicDir: 'assets',
  define: {
    __BUILD_MODE__: JSON.stringify(
      command === 'serve' ? 'debug' : mode === 'release' ? 'release' : 'debug'
    ),
    __MK_VERSION__: JSON.stringify(process.env.MK_VERSION || '0.0.0-dev'),
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
