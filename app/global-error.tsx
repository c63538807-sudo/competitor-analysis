'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error boundary caught:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border border-red-800/60 bg-red-950/20 p-6 text-center">
            <p className="text-lg font-semibold text-red-300">Something went wrong</p>
            <p className="mt-2 text-sm text-red-400">
              {error.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={reset}
              className="mt-6 rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 active:scale-[0.98]"
            >
              Try Again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
