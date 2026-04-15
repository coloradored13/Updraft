import { defineConfig } from 'vite';
import { compression } from 'vite-plugin-compression2';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Single chunk is optimal for a game this size — avoids waterfall requests
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
    // Minification
    minify: 'esbuild',
    // Inline small assets (< 4KB) as base64
    assetsInlineLimit: 4096,
    // Generate source maps for debugging production issues
    sourcemap: false,
    // Target modern browsers
    target: 'es2020',
    // Single bundle is intentional for this game
    chunkSizeWarningLimit: 1600,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Cache the single JS bundle and HTML
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,json}'],
        // Game should work fully offline once loaded
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      manifest: {
        name: 'Updraft',
        short_name: 'Updraft',
        description: 'A serene paper airplane game — ride the wind, find your calm.',
        theme_color: '#87CEEB',
        background_color: '#87CEEB',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
    // Pre-compress assets for servers that support serving .gz/.br files
    compression({ algorithm: 'gzip', exclude: [/\.(br)$/] }),
    compression({ algorithm: 'brotliCompress', exclude: [/\.(gz)$/] }),
  ],
  server: {
    host: true,
    port: 3000,
  },
});
