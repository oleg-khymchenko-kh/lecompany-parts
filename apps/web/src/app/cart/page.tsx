'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, formatMoney } from '@/lib/api';

type CartLine = {
  id: string;
  quantity: number;
  lineTotalMinor: number;
  product: { id: string; name: string; sku: string; currency: string };
};
type CartView = { lines: CartLine[]; subtotalMinor: number; currency: string };

export default function CartPage() {
  const [cart, setCart] = useState<CartView | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<CartView>('/cart')
      .then(setCart)
      .catch(() => setCart(null));
  }, []);

  async function checkout() {
    setError(null);
    setBusy(true);
    try {
      const { url } = await api<{ url: string | null }>('/checkout/session', {
        method: 'POST',
        body: JSON.stringify(email ? { email } : {}),
      });
      if (url) window.location.href = url;
    } catch (caught) {
      setBusy(false);
      if (caught instanceof ApiError && caught.code === 'email_required') {
        setError('Enter an email address so we can send the receipt.');
      } else if (caught instanceof ApiError && caught.code === 'insufficient_stock') {
        setError('One of these items has just sold out. Adjust the quantity and try again.');
      } else {
        setError('Checkout could not start. Please try again.');
      }
    }
  }

  if (!cart) return <p className="text-neutral-500">Loading…</p>;

  if (cart.lines.length === 0) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Cart</h1>
        <p className="text-neutral-600 dark:text-neutral-400">Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Cart</h1>

      <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {cart.lines.map((line) => (
          <li key={line.id} className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="font-medium">{line.product.name}</p>
              <p className="font-mono text-xs text-neutral-500">{line.product.sku}</p>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min={0}
                max={99}
                value={line.quantity}
                onChange={async (event) => {
                  const updated = await api<CartView>(`/cart/items/${line.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ quantity: Number(event.target.value) }),
                  });
                  setCart(updated);
                }}
                className="w-16 rounded-md border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
              />
              <span className="w-20 text-right">
                {formatMoney(line.lineTotalMinor, line.product.currency)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <span className="font-medium">Subtotal</span>
        <span className="text-lg">{formatMoney(cart.subtotalMinor, cart.currency)}</span>
      </div>

      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Email for the receipt</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Leave blank if you are signed in"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={checkout}
          disabled={busy}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {busy ? 'Starting checkout…' : 'Checkout'}
        </button>
      </div>
    </div>
  );
}
