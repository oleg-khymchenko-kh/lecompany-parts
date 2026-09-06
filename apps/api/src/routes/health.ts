import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db.js';

const DB_PROBE_TIMEOUT_MS = 3000;

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/health/deep', async (_request, reply) => {
    // The MySQL driver will sit and wait on an unreachable host, which would
    // make this probe hang rather than report. Bound it.
    const probe = prisma.$queryRaw`SELECT 1`;
    const timeout = new Promise((_resolve, rejectProbe) => {
      setTimeout(() => rejectProbe(new Error('db_probe_timeout')), DB_PROBE_TIMEOUT_MS).unref();
    });

    try {
      await Promise.race([probe, timeout]);
      return { status: 'ok', database: 'ok' };
    } catch {
      return reply.code(503).send({ status: 'degraded', database: 'unreachable' });
    }
  });
};

export default healthRoutes;
