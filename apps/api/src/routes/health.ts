import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db.js';

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/health/deep', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'ok' };
    } catch {
      return reply.code(503).send({ status: 'degraded', database: 'unreachable' });
    }
  });
};

export default healthRoutes;
