import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { getOrCreateCart, loadCartView } from '../lib/cart.js';
import { parseOr400 } from '../lib/http.js';

const addSchema = z.object({
  productId: z.string().min(1).max(50),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

const cartRoutes: FastifyPluginAsync = async (app) => {
  app.get('/cart', async (request, reply) => {
    const cart = await getOrCreateCart(request, reply);
    return loadCartView(cart.id);
  });

  app.post('/cart/items', async (request, reply) => {
    const body = parseOr400(addSchema, request.body, reply);
    if (!body) return;

    const product = await prisma.product.findFirst({
      where: { id: body.productId, active: true },
    });
    if (!product) return reply.code(404).send({ error: 'product_not_found' });

    const cart = await getOrCreateCart(request, reply);
    const existing = await prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId: product.id } },
    });

    const quantity = Math.min((existing?.quantity ?? 0) + body.quantity, 99);

    await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: product.id } },
      update: { quantity },
      create: { cartId: cart.id, productId: product.id, quantity },
    });

    return loadCartView(cart.id);
  });

  app.patch('/cart/items/:itemId', async (request, reply) => {
    const params = parseOr400(z.object({ itemId: z.string().min(1) }), request.params, reply);
    if (!params) return;
    const body = parseOr400(
      z.object({ quantity: z.coerce.number().int().min(0).max(99) }),
      request.body,
      reply,
    );
    if (!body) return;

    const cart = await getOrCreateCart(request, reply);
    const item = await prisma.cartItem.findFirst({
      where: { id: params.itemId, cartId: cart.id },
    });
    if (!item) return reply.code(404).send({ error: 'item_not_found' });

    if (body.quantity === 0) {
      await prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: body.quantity } });
    }

    return loadCartView(cart.id);
  });

  app.delete('/cart/items/:itemId', async (request, reply) => {
    const params = parseOr400(z.object({ itemId: z.string().min(1) }), request.params, reply);
    if (!params) return;

    const cart = await getOrCreateCart(request, reply);
    await prisma.cartItem.deleteMany({ where: { id: params.itemId, cartId: cart.id } });
    return loadCartView(cart.id);
  });
};

export default cartRoutes;
