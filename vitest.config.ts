import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'next/link': new URL('./tests/__mocks__/next-link.tsx', import.meta.url).pathname,
      'next/navigation': new URL('./tests/__mocks__/next-navigation.ts', import.meta.url).pathname,
    },
  },
  test: {
    globals: true,
    include: ['tests/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: ['node_modules', 'dist'],
    environment: 'happy-dom',
  },
});
