import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import infinceComponentTagger from '@infince/component-tagger';

export default defineConfig({
  plugins: [react(), infinceComponentTagger()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: true,
    port: 5173,
    // Fail if 5173 is taken rather than silently moving to 5174 (Traefik routes to 5173).
    strictPort: true,
    // Behind Traefik the Host header is {projectId}.local.fisquare.net; allow it.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.API_URL ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
