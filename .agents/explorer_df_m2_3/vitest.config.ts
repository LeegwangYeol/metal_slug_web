import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['.agents/explorer_df_m2_3/**/*.test.ts'],
  },
});
