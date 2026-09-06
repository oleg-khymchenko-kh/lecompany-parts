import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { env, isProduction } from './env.js';
import { PrismaClient } from './generated/prisma/client.js';

const url = new URL(env.DATABASE_URL);

// The adapter is a plain JS MySQL driver — nothing platform-specific is built
// or shipped, which is what lets the artefact be built on Windows and run on Linux.
//
// Configured from parts rather than handed the URL string so the options below
// cannot be lost the next time someone edits DATABASE_URL by hand.
const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: url.port ? Number(url.port) : 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ''),
  connectionLimit: 10,
  // MySQL 8.4 authenticates with caching_sha2_password, which on a first,
  // non-TLS connection requires fetching the server's RSA public key. Enabling
  // that would expose the password to a man in the middle — there is none here:
  // the database listens on loopback and 3306 is firewalled off the internet.
  allowPublicKeyRetrieval: true,
});

export const prisma = new PrismaClient({
  adapter,
  log: isProduction ? ['warn', 'error'] : ['query', 'warn', 'error'],
});
