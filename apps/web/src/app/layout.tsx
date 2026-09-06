import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'LE Company Parts & Equipment',
    template: '%s — LE Company Parts & Equipment',
  },
  description:
    'PCB and control board repair, spare parts and refurbished commercial equipment from LE Company.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-dvh bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <nav className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-5 py-4">
            <Link href="/" className="font-semibold tracking-tight">
              LE Company <span className="text-neutral-500">Parts &amp; Equipment</span>
            </Link>
            <div className="flex items-center gap-5 text-sm">
              <Link href="/cart" className="hover:underline">
                Cart
              </Link>
              <Link href="/account" className="hover:underline">
                Account
              </Link>
            </div>
          </nav>
        </header>

        <main className="mx-auto max-w-5xl px-5 py-10">{children}</main>

        <footer className="mt-16 border-t border-neutral-200 px-5 py-8 text-sm text-neutral-500 dark:border-neutral-800">
          <div className="mx-auto max-w-5xl">
            LE Company — London Engineers Company Ltd.
          </div>
        </footer>
      </body>
    </html>
  );
}
