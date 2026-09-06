'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, formatMoney } from '@/lib/api';

type SessionUser = { id: string; email: string; name: string | null; role: string };
type Order = {
  id: string;
  orderNumber: string;
  status: string;
  totalMinor: number;
  currency: string;
  createdAt: string;
};

export default function AccountPage() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    api<{ user: SessionUser | null }>('/auth/me')
      .then(async (data) => {
        setUser(data.user);
        if (data.user) {
          const res = await api<{ orders: Order[] }>('/orders');
          setOrders(res.orders);
        }
      })
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) return <p className="text-neutral-500">Loading…</p>;

  if (user === null) {
    return (
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          <Link href="/account/sign-in" className="underline">
            Sign in
          </Link>
          {' to see your orders.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{user.name ?? user.email}</h1>
        <button
          type="button"
          onClick={async () => {
            await api('/auth/logout', { method: 'POST' });
            window.location.href = '/';
          }}
          className="text-sm text-neutral-500 underline"
        >
          Sign out
        </button>
      </div>

      <section className="space-y-3">
        <h2 className="font-medium">Orders</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-neutral-500">No orders yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {orders.map((order) => (
              <li key={order.id} className="flex items-center justify-between py-3 text-sm">
                <span className="font-mono">{order.orderNumber}</span>
                <span className="text-neutral-500">{order.status}</span>
                <span>{formatMoney(order.totalMinor, order.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
