import type { FastifyReply } from 'fastify';
import { ZodError, type ZodTypeAny, type z } from 'zod';

/**
 * Parses a body/query against a schema and replies 400 on failure.
 * Returns null when it has already answered, so callers `if (!data) return;`.
 */
export function parseOr400<T extends ZodTypeAny>(
  schema: T,
  input: unknown,
  reply: FastifyReply,
): z.infer<T> | null {
  try {
    return schema.parse(input) as z.infer<T>;
  } catch (error) {
    if (error instanceof ZodError) {
      reply.code(400).send({
        error: 'validation_failed',
        details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
      return null;
    }
    throw error;
  }
}
