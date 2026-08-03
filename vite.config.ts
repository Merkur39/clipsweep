import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Relative asset paths so the build works from a domain root as well as from
  // a subpath, whoever ends up serving it.
  base: './',
  plugins: [react()],
  test: {
    // Pure logic runs under node; component tests ask for the DOM through a
    // `@vitest-environment jsdom` docblock at the top of the file.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test-setup.ts'],
    restoreMocks: true,
  },
})
