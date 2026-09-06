import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { parseOr400 } from '../lib/http.js';

const listQuery = z.object({
  kind: z.enum(['PART', 'PCB_REPAIR', 'REFURBISHED']).optional(),
  brand: z.string().trim().max(80).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(60).default(24),
});

const catalogRoutes: FastifyPluginAsync = async (app) => {
  app.get('/products', async (request, reply) => {
    const query = parseOr400(listQuery, request.query, reply);
    if (!query) return;

    const where = {
      active: true,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.brand ? { brand: query.brand } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              { sku: { contains: query.q } },
              { modelRef: { contains: query.q } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
        include: { images: { orderBy: { position: 'asc' }, take: 1 } },
      }),
      prisma.product.count({ where }),
    ]);

    return { items, total, page: query.page, perPage: query.perPage };
  });

  app.get('/products/:slug', async (request, reply) => {
    const params = parseOr400(
      z.object({ slug: z.string().trim().min(1).max(200) }),
      request.params,
      reply,
    );
    if (!params) return;

    const product = await prisma.product.findFirst({
      where: { slug: params.slug, active: true },
      include: { images: { orderBy: { position: 'asc' } } },
    });

    if (!product) return reply.code(404).send({ error: 'not_found' });
    return { product };
  });
};

export default catalogRoutes;
