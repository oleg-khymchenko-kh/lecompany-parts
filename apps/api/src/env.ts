import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3011),
  HOST: z.string().default('127.0.0.1'),

  DATABASE_URL: z.string().min(1),

  // Public origin of the front end — used for CORS, cookies and Stripe redirects.
  SITE_URL: z.string().url(),
  COOKIE_DOMAIN: z.string().optional(),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),

  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),

  SENDGRID_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default('LE Company Parts <no-reply@parts.lecompany.co.uk>'),
  // Optional blind copy of every outgoing message, for the office archive.
  MAIL_BCC: z.string().optional(),

  // Prisma Migrate only; the running server never uses it.
  SHADOW_DATABASE_URL: z.string().optional(),
});

// A key left blank in .env arrives as an empty string, not as absent, which
// makes every optional field fail its own validation. Treat blank as unset.
const supplied = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== undefined && value !== ''),
);

const parsed = schema.safeParse(supplied);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment:\n${issues}`);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
