import { randomInt } from 'node:crypto';

/** Human-quotable order reference, e.g. LEP-7K3M-2Q9X. Ambiguous glyphs removed. */
const ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY3479';

export function generateOrderNumber(): string {
  const block = () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `LEP-${block()}-${block()}`;
}
