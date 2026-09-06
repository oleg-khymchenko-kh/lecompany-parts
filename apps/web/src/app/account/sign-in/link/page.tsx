'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/api';

function LinkConsumer() {
  const router = useRouter();
  const token = useSearchParams().get('token');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('This link is missing its token.');
      return;
    }

    let cancelled = false;
    // POST, not GET: mail gateways that pre-fetch links must not burn the token.
    api('/auth/magic-link/consume', { method: 'POST', body: JSON.stringify({ token }) })
      .then(() => {
        if (cancelled) return;
        router.replace('/account');
        router.refresh();
      })
      .catch(() => {
        if (!cancelled) setError('That link has expired or has already been used.');
      });

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  return (
    <div className="max-w-md space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">
        {error ? 'Link not valid' : 'Signing you in…'}
      </h1>
      {error && <p className="text-neutral-600 dark:text-neutral-400">{error}</p>}
    </div>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense fallback={<p>Signing you in…</p>}>
      <LinkConsumer />
    </Suspense>
  );
}
