import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../db.js';
import { env, isProduction } from '../env.js';
import { generateToken, hashToken } from './crypto.js';

export const SESSION_COOKIE = 'parts_session';

function cookieOptions(maxAgeSeconds: number) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction,
    domain: env.COOKIE_DOMAIN,
    maxAge: maxAgeSeconds,
  };
}

export async function createSession(
  reply: FastifyReply,
  userId: string,
  meta: { userAgent?: string | undefined; ip?: string | undefined } = {},
): Promise<void> {
  const token = generateToken();
  const ttlSeconds = env.SESSION_TTL_DAYS * 24 * 60 * 60;

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
    },
  });

  reply.setCookie(SESSION_COOKIE, token, cookieOptions(ttlSeconds));
}

export async function destroySession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies[SESSION_COOKIE];
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  reply.clearCookie(SESSION_COOKIE, { path: '/', domain: env.COOKIE_DOMAIN });
}

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
};

export async function resolveUser(request: FastifyRequest): Promise<SessionUser | null> {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true, name: true, role: true } } },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Cheap activity tracking without a write on every request.
  if (Date.now() - session.lastSeenAt.getTime() > 60 * 60 * 1000) {
    await prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }

  return session.user;
}
