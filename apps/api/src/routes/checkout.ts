import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { getOrCreateCart, loadCartView } from '../lib/cart.js';
import { parseOr400 } from '../lib/http.js';
import { generateOrderNumber } from '../lib/orderNumber.js';
import { stripe } from '../lib/stripe.js';

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254).optional(),
});

const checkoutRoutes: FastifyPluginAsync = async (app) => {
  app.post('/checkout/session', async (request, reply) => {
    const body = parseOr400(bodySchema, request.body ?? {}, reply);
    if (!body) return;

    const email = request.user?.email ?? body.email;
    if (!email) return reply.code(400).send({ error: 'email_required' });

    const cart = await getOrCreateCart(request, reply);
    const view = await loadCartView(cart.id);

    if (view.lines.length === 0) return reply.code(400).send({ error: 'cart_empty' });

    // Stock is checked here and again by the webhook; a customer must not be
    // charged for something that sold out while they were on Stripe's page.
    const outOfStock = view.lines.filter((line) => line.product.stock < line.quantity);
    if (outOfStock.length > 0) {
      return reply.code(409).send({
        error: 'insufficient_stock',
        items: outOfStock.map((line) => ({
          productId: line.product.id,
          available: line.product.stock,
        })),
      });
    }

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: request.user?.id ?? null,
        email,
        subtotalMinor: view.subtotalMinor,
        totalMinor: view.subtotalMinor,
        currency: view.currency,
        items: {
          create: view.lines.map((line) => ({
            productId: line.product.id,
            nameSnapshot: line.product.name,
            skuSnapshot: line.product.sku,
            unitPriceMinor: line.product.priceMinor,
            quantity: line.quantity,
          })),
        },
      },
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      client_reference_id: order.id,
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
      line_items: view.lines.map((line) => ({
        quantity: line.quantity,
        price_data: {
          currency: line.product.currency.toLowerCase(),
          unit_amount: line.product.priceMinor,
          product_data: {
            name: line.product.name,
            metadata: { sku: line.product.sku },
          },
        },
      })),
      success_url: `${env.SITE_URL}/checkout/complete?order=${order.orderNumber}`,
      cancel_url: `${env.SITE_URL}/cart`,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { stripeCheckoutSessionId: session.id },
    });

    return { orderNumber: order.orderNumber, url: session.url };
  });
};

export default checkoutRoutes;
