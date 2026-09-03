import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Cat Care Tracker',
        short_name: 'Cat Tracker',
        description: 'Offline-first household tracker for cat food, litter, expenses, and supplies.',
        theme_color: '#4f7cac',
        background_color: '#f7f5f1',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  server: {
    port: 5173,
    strictPort: true,
    allowedHosts: ['barrel-stroller-talcum.ngrok-free.dev'],
  },
  preview: {
    port: 4174,
    strictPort: true,
    allowedHosts: ['barrel-stroller-talcum.ngrok-free.dev'],
  },
});