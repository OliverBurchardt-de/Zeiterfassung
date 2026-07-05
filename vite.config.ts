import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    // Server-Modus (npm run dev:api): /api-Anfragen an das Backend durchreichen —
    // same-origin für den Browser, dadurch funktioniert das Session-Cookie ohne CORS.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
