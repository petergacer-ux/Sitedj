import { defineConfig } from 'vitest/config';

// Configuration Vite + Vitest.
// - base './' : le build fonctionne aussi ouvert depuis un sous-dossier.
// - Les tests (moteur réseau, CLI, collisions…) tournent en environnement Node, sans Three.js ni DOM.
export default defineConfig({
  base: './',
  server: { open: false },
  // Three.js pèse ~600 ko minifié : c'est normal pour un jeu 3D.
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
