import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Tests laufen in jsdom (Store nutzt localStorage-Persist). Alias '@' wie in vite.config.ts.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
