import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Used by the Prisma CLI only (generate, migrate, studio). The running server
// gets its connection from the driver adapter in src/db.ts.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: { path: path.join('prisma', 'migrations') },
  datasource: {
    url: process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
