import type { FastifyPluginAsync } from 'fastify';
import type Stripe from 'stripe';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { stripe } from '../lib/stripe.js';

const webhookRoutes: FastifyPluginAsync = async (app) => {
  // Signature verification needs the bytes exactly as sent, so this scope keeps
  // the raw buffer instead of parsing JSON.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_request, body, done) => done(null, body),
  );

  app.post('/webhooks/stripe', async (request, reply) => {
    const signature = request.headers['stripe-signature'];
    if (typeof signature !== 'string') {
      return reply.code(400).send({ error: 'missing_signature' });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        request.body as Buffer,
        signature,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (error) {
      request.log.warn({ err: error }, 'stripe webhook signature rejected');
      return reply.code(400).send({ error: 'invalid_signature' });
    }

    // Stripe retries and may deliver the same event more than once.
    const seen = await prisma.processedWebhook.findUnique({ where: { id: event.id } });
    if (seen) return { received: true, duplicate: true };

    try {
      await handleEvent(event, request.log);
    } catch (error) {
      request.log.error({ err: error, eventId: event.id }, 'stripe webhook handler failed');
      // 500 makes Stripe retry, which is what we want for a transient failure.
      return reply.code(500).send({ error: 'handler_failed' });
    }

    await prisma.processedWebhook.create({ data: { id: event.id, type: event.type } });
    return { received: true };
  });
};

async function handleEvent(event: Stripe.Event, log: { info: (o: object, m: string) => void }) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId ?? session.client_reference_id;
      if (!orderId) return;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order || order.status !== 'PENDING') return;

      const address = session.customer_details?.address;

      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            stripePaymentIntentId:
              typeof session.payment_intent === 'string' ? session.payment_intent : null,
            shippingName: session.customer_details?.name ?? null,
            shippingLine1: address?.line1 ?? null,
            shippingLine2: address?.line2 ?? null,
            shippingCity: address?.city ?? null,
            shippingPostcode: address?.postal_code ?? null,
            shippingCountry: address?.country ?? null,
          },
        }),
        // Decrement stock for what was actually bought.
        ...order.items
          .filter((item) => item.productId !== null)
          .map((item) =>
            prisma.product.update({
              where: { id: item.productId as string },
              data: { stock: { decrement: item.quantity } },
            }),
          ),
        // The cart has served its purpose.
        prisma.cartItem.deleteMany({
          where: { cart: order.userId ? { userId: order.userId } : { id: '' } },
        }),
      ]);

      log.info({ orderNumber: order.orderNumber }, 'order paid');
      break;
    }

    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId ?? session.client_reference_id;
      if (!orderId) return;
      await prisma.order.updateMany({
        where: { id: orderId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      break;
    }

    default:
      break;
  }
}

export default webhookRoutes;
