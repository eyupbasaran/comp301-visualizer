import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
    // The on-disk transform cache keeps old import.meta.glob results, so newly
    // added tests/official/*.json files would be skipped without a warning.
    fsModuleCache: false,
  },
});
