import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { generateToken, hashPassword, hashToken, verifyPassword } from '../lib/crypto.js';
import { parseOr400 } from '../lib/http.js';
import { sendMail } from '../lib/mailer.js';
import { createSession, destroySession } from '../lib/session.js';

const emailSchema = z.string().trim().toLowerCase().email().max(254);

const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(10).max(200),
  name: z.string().trim().min(1).max(120).optional(),
  companyName: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

const MAGIC_LINK_TTL_MINUTES = 15;

const authRoutes: FastifyPluginAsync = async (app) => {
  // Credential endpoints are the ones worth throttling.
  const strictLimit = { rateLimit: { max: 10, timeWindow: '15 minutes' } };

  app.post('/auth/register', { config: strictLimit }, async (request, reply) => {
    const body = parseOr400(registerSchema, request.body, reply);
    if (!body) return;

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      // Do not confirm which addresses are registered.
      return reply.code(409).send({ error: 'email_unavailable' });
    }

    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash: await hashPassword(body.password),
        name: body.name ?? null,
        companyName: body.companyName ?? null,
        phone: body.phone ?? null,
      },
    });

    await createSession(reply, user.id, {
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });

    return reply.code(201).send({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  });

  app.post('/auth/login', { config: strictLimit }, async (request, reply) => {
    const body = parseOr400(loginSchema, request.body, reply);
    if (!body) return;

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    const ok = user?.passwordHash
      ? await verifyPassword(body.password, user.passwordHash)
      : false;

    if (!user || !ok) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    await createSession(reply, user.id, {
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });

    return { user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  });

  // Magic link, step 1 — always answers 202 so the endpoint cannot be used to
  // enumerate registered addresses.
  app.post('/auth/magic-link', { config: strictLimit }, async (request, reply) => {
    const body = parseOr400(z.object({ email: emailSchema }), request.body, reply);
    if (!body) return;

    const user = await prisma.user.upsert({
      where: { email: body.email },
      update: {},
      create: { email: body.email },
    });

    const token = generateToken();
    await prisma.loginToken.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        purpose: 'MAGIC_LINK',
        expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000),
      },
    });

    const url = `${env.SITE_URL}/account/sign-in/link?token=${token}`;
    await sendMail({
      to: user.email,
      subject: 'Your sign-in link — LE Company Parts',
      text: [
        'Use the link below to sign in. It works once and expires in',
        `${MAGIC_LINK_TTL_MINUTES} minutes.`,
        '',
        url,
        '',
        'If you did not ask for this, ignore this email.',
      ].join('\n'),
    });

    return reply.code(202).send({ status: 'sent' });
  });

  // Magic link, step 2. POST rather than GET so link-scanning proxies in mail
  // gateways cannot burn the token before the customer clicks it.
  app.post('/auth/magic-link/consume', { config: strictLimit }, async (request, reply) => {
    const body = parseOr400(
      z.object({ token: z.string().min(10).max(200) }),
      request.body,
      reply,
    );
    if (!body) return;

    const record = await prisma.loginToken.findUnique({
      where: { tokenHash: hashToken(body.token) },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      return reply.code(400).send({ error: 'invalid_or_expired_token' });
    }

    await prisma.$transaction([
      prisma.loginToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: record.user.emailVerifiedAt ?? new Date() },
      }),
    ]);

    await createSession(reply, record.userId, {
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });

    return {
      user: {
        id: record.user.id,
        email: record.user.email,
        name: record.user.name,
        role: record.user.role,
      },
    };
  });

  app.post('/auth/logout', async (request, reply) => {
    await destroySession(request, reply);
    return { status: 'signed_out' };
  });

  app.get('/auth/me', async (request) => ({ user: request.user }));
};

export default authRoutes;
