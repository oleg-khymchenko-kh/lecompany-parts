'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

type Mode = 'password' | 'link';

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus('busy');

    try {
      if (mode === 'password') {
        await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        router.push('/account');
        router.refresh();
        return;
      }

      await api('/auth/magic-link', { method: 'POST', body: JSON.stringify({ email }) });
      setStatus('sent');
    } catch (caught) {
      setStatus('idle');
      setError(
        caught instanceof ApiError && caught.code === 'invalid_credentials'
          ? 'That email and password do not match.'
          : 'Something went wrong. Please try again.',
      );
    }
  }

  if (status === 'sent') {
    return (
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          If <span className="font-medium">{email}</span> has an account, a sign-in link is
          on its way. It works once and expires in 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>

      <div className="flex gap-2 text-sm">
        {(['password', 'link'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setMode(option);
              setError(null);
            }}
            className={`rounded-md border px-3 py-1.5 transition ${
              mode === option
                ? 'border-neutral-900 dark:border-neutral-100'
                : 'border-neutral-200 text-neutral-500 dark:border-neutral-800'
            }`}
          >
            {option === 'password' ? 'With password' : 'Email me a link'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>

        {mode === 'password' && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={status === 'busy'}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {mode === 'password' ? 'Sign in' : 'Send link'}
        </button>
      </form>
    </div>
  );
}
