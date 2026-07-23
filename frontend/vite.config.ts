/// <reference types="vitest/config" />
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Vitest extends Vite config at runtime; types come from vitest/config reference.
  // @ts-expect-error Vitest `test` block is valid at runtime (see /// reference above)
  test: {
    // Vitest config — UI Bible §DS-9 accessibility + unit tests
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'src/test/**',
        'src/pages/gallery/**',
        '**/*.d.ts',
      ],
    },
  },
})
