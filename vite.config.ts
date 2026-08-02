import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Relative asset paths so the build works from a domain root as well as from
  // a subpath, whoever ends up serving it.
  base: './',
  plugins: [react()],
  test: {
    // La logique pure tourne sous node ; les tests de composants demandent le
    // DOM via un docblock `@vitest-environment jsdom` en tête de fichier.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test-setup.ts'],
    restoreMocks: true,
  },
})
