'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';

type CollectorShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export default function CollectorShell({
  title,
  subtitle,
  children,
  footer,
}: CollectorShellProps) {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 text-slate-50">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-2xl flex-col rounded-[28px] border border-slate-800 bg-slate-900/80 p-4 shadow-2xl shadow-slate-950/40">
        <header className="mb-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Collector MVP</p>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100 active:scale-[0.96]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Home
            </button>
          </div>
          <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-slate-400">{subtitle}</p> : null}
        </header>

        <section className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
          {children}
        </section>

        {footer ? <div className="mt-4">{footer}</div> : null}
      </div>
    </main>
  );
}
