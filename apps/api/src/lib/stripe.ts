import Stripe from 'stripe';
import { env } from '../env.js';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  // Pinned to the version this SDK is typed against. Bump both together.
  apiVersion: '2026-08-26.dahlia',
  appInfo: { name: 'parts.lecompany.co.uk' },
});
