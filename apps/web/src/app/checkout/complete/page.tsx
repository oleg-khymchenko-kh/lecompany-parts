import Link from 'next/link';

export const metadata = { title: 'Order received' };

export default async function CheckoutCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Thank you</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        {order ? (
          <>
            {'Your order reference is '}
            <span className="font-mono font-medium">{order}</span>
            {'. A confirmation follows by email once the payment settles.'}
          </>
        ) : (
          'Your payment is being confirmed.'
        )}
      </p>
      <Link href="/account" className="inline-block text-sm underline">
        View your orders
      </Link>
    </div>
  );
}
