import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'BLACKLINE — Crime Life Simulator', short_name: 'BLACKLINE',
      description: 'Every choice leaves a mark. An offline crime life RPG.',
      theme_color: '#101212', background_color: '#101212', display: 'standalone',
      orientation: 'portrait', start_url: '/',
      icons: [
        {src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png'},
        {src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable'}
      ]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,webp,png,woff2}'],
      // Manifest icons are added with revisions by the PWA plugin. Exclude them
      // from this glob so Workbox cannot receive conflicting duplicate entries.
      globIgnores: ['**/icon-192.png', '**/icon-512.png'],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
    }
  })],
  server: { host: '0.0.0.0', port: 5173 },
  test: { environment: 'node', include: ['src/**/*.test.ts'], clearMocks: true }
});
