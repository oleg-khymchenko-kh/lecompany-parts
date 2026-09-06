import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { parseOr400 } from '../lib/http.js';

const orderRoutes: FastifyPluginAsync = async (app) => {
  app.get('/orders', { onRequest: [app.requireUser] }, async (request) => {
    const orders = await prisma.order.findMany({
      where: { userId: request.user!.id },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    return { orders };
  });

  app.get('/orders/:orderNumber', { onRequest: [app.requireUser] }, async (request, reply) => {
    const params = parseOr400(
      z.object({ orderNumber: z.string().trim().min(1).max(40) }),
      request.params,
      reply,
    );
    if (!params) return;

    const order = await prisma.order.findFirst({
      where: { orderNumber: params.orderNumber, userId: request.user!.id },
      include: { items: true },
    });

    if (!order) return reply.code(404).send({ error: 'not_found' });
    return { order };
  });
};

export default orderRoutes;
