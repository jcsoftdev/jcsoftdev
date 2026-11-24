import type { ReactNode } from 'react';

interface PageProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
}

export function Page({ title, subtitle, children }: PageProps) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-10">
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-3xl font-bold text-ink">{title}</h1>
        {subtitle ? <p className="text-ink-2">{subtitle}</p> : null}
      </header>
      {children}
    </main>
  );
}
