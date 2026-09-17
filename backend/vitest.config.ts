import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    // A handful of tests do vi.resetModules() + a fresh dynamic import of
    // the whole app per test (to get a clean env-var read) — as the
    // import graph has grown across phases, that cold re-import can
    // occasionally exceed the 5s default under full-suite parallel
    // worker contention, even though each test runs in ~100ms in
    // isolation. This doesn't mask a real hang, it just gives slow cold
    // starts room to finish.
    testTimeout: 15000,
  },
})
