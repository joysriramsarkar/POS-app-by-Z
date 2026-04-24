import path from 'node:path';
import { defineConfig } from 'prisma/config';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(path.resolve(__dirname, '..'));

export default defineConfig({
  datasource: {
    url: process.env.DIRECT_URL!,
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
