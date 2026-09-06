import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../db.js';
import { env, isProduction } from '../env.js';
import { generateToken } from './crypto.js';

export const CART_COOKIE = 'parts_cart';

/**
 * Returns the caller's cart, creating one if needed. An anonymous cart is
 * carried by a cookie; once the caller is signed in the cart is claimed so it
 * survives a change of device.
 */
export async function getOrCreateCart(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user?.id ?? null;

  if (userId) {
    const owned = await prisma.cart.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    if (owned) return owned;
  }

  const token = request.cookies[CART_COOKIE];
  if (token) {
    const existing = await prisma.cart.findUnique({ where: { token } });
    if (existing) {
      if (userId && existing.userId !== userId) {
        return prisma.cart.update({ where: { id: existing.id }, data: { userId } });
      }
      return existing;
    }
  }

  const newToken = generateToken();
  const cart = await prisma.cart.create({ data: { token: newToken, userId } });

  reply.setCookie(CART_COOKIE, newToken, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    domain: env.COOKIE_DOMAIN,
    maxAge: 60 * 60 * 24 * 90,
  });

  return cart;
}

export async function loadCartView(cartId: string) {
  const items = await prisma.cartItem.findMany({
    where: { cartId },
    include: { product: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } } },
    orderBy: { id: 'asc' },
  });

  const lines = items.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    product: item.product,
    lineTotalMinor: item.product.priceMinor * item.quantity,
  }));

  return {
    id: cartId,
    lines,
    subtotalMinor: lines.reduce((sum, line) => sum + line.lineTotalMinor, 0),
    currency: lines[0]?.product.currency ?? 'GBP',
  };
}
