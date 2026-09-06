import Link from 'next/link';

const lines = [
  {
    href: '/parts/pcb-repair',
    title: 'PCB & control board repair',
    body: 'Board-level repair for commercial equipment, sent in or collected.',
  },
  {
    href: '/parts/spares',
    title: 'Spare parts',
    body: 'Components and assemblies for machines still worth keeping.',
  },
  {
    href: '/parts/refurbished',
    title: 'Refurbished machines',
    body: 'Whole machines, restored and resold.',
  },
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          The alternative to buying new.
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          When a control board is discontinued, an engineer can only fit a part somebody
          else still makes. We repair the board instead.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {lines.map((line) => (
          <Link
            key={line.href}
            href={line.href}
            className="rounded-lg border border-neutral-200 p-5 transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
          >
            <h2 className="font-medium">{line.title}</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{line.body}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
