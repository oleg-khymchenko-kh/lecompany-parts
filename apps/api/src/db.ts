import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { env, isProduction } from './env.js';
import { PrismaClient } from './generated/prisma/client.js';

// The adapter is a plain JS MySQL driver — nothing platform-specific is built
// or shipped, which is what lets the artefact be built on Windows and run on Linux.
const adapter = new PrismaMariaDb(env.DATABASE_URL);

export const prisma = new PrismaClient({
  adapter,
  log: isProduction ? ['warn', 'error'] : ['query', 'warn', 'error'],
});
