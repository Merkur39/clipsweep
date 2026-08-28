import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Relative asset paths so the build works from a domain root as well as from
  // a subpath, whoever ends up serving it.
  base: './',
  plugins: [react()],
  /* Pinned, and it must fail rather than slide. `redirectUri()` derives the
     OAuth redirect from `location.origin`, and only `http://localhost:5173/` is
     declared on the Twitch application — see `.env.example`. Left to its
     default, an occupied 5173 moves the dev server to 5174 and sign-in comes
     back `redirect_mismatch`, which says nothing about the port. A refusal to
     start names the problem where it is. */
  server: { port: 5173, strictPort: true },
  test: {
    // Pure logic runs under node; component tests ask for the DOM through a
    // `@vitest-environment jsdom` docblock at the top of the file.
    environment: 'node',
    // `scripts/` holds tooling run by Node, outside the bundle: its pure parts
    // are tested here rather than in a runner of their own.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
    setupFiles: ['src/test-setup.ts'],
    // Pinned, because `BUILD_TIME_CLIENT_ID` decides whether the application
    // considers itself configured at all: without it, a developer with an
    // `.env.local` and a runner without one do not render the same interface,
    // and a test can pass here and fail there for a reason it never states.
    env: { VITE_TWITCH_CLIENT_ID: 'test-client' },
    // `restoreMocks` puts back what `vi.spyOn` replaced; since Vitest 4 that
    // is all it does, so a bare `vi.fn()` would carry its calls and its
    // implementation into the next test. `mockReset` clears both.
    restoreMocks: true,
    mockReset: true,
  },
})
