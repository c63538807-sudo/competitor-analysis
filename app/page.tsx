'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import CollectorShell from '@/components/collector-shell';
import PrimaryButton from '@/components/primary-button';
import SecondaryButton from '@/components/secondary-button';
import { useSessionStore } from '@/store/session-store';
import { loadSession } from '@/lib/idb';
import type { CompetitorCard as CompetitorCardType } from '@/types';

export default function HomePage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);

  const sessionId = useSessionStore((state) => state.sessionId);
  const date = useSessionStore((state) => state.date);
  const questions = useSessionStore((state) => state.questions);
  const competitors = useSessionStore((state) => state.competitors);
  const competitorQuestionIndices = useSessionStore((state) => state.competitorQuestionIndices);
  const answers = useSessionStore((state) => state.answers);
  const screenshots = useSessionStore((state) => state.screenshots);
  const metadata = useSessionStore((state) => state.metadata);
  const progress = useSessionStore((state) => state.progress);
  const completed = useSessionStore((state) => state.completed);
  const restoreSession = useSessionStore((state) => state.restoreSession);

  // ---------------------------------------------------------
  // Restore from IDB on mount
  // ---------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const saved = await loadSession();
      if (cancelled) return;
      if (saved && saved.sessionId) {
        restoreSession(saved);
      }
      setHydrated(true);
    }
    init();
    return () => { cancelled = true; };
  }, [restoreSession]);

  // ---------------------------------------------------------
  // Build competitor cards for the dashboard
  // ---------------------------------------------------------
  const cards = useMemo<CompetitorCardType[]>(() => {
    return competitors.map((name) => {
      const idx = competitorQuestionIndices[name] ?? 0;
      const total = questions.length;

      let status: CompetitorCardType['status'] = 'not-started';
      if (idx > 0 && idx < total) {
        status = 'in-progress';
      } else if (idx >= total && total > 0) {
        status = 'completed';
      }

      return {
        name,
        currentQuestionIndex: idx,
        totalQuestions: total,
        status,
        hasMetadata: Boolean(metadata[name]?.modelUsed?.trim()),
      };
    });
  }, [competitors, competitorQuestionIndices, questions, metadata]);

  // ---------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------

  const handleCreate = useCallback(() => {
    router.push('/import');
  }, [router]);

  const handleContinueCompetitor = useCallback(
    (name: string) => {
      router.push(`/competitor-session?c=${encodeURIComponent(name)}`);
    },
    [router],
  );

  const handleExport = useCallback(() => {
    router.push('/export');
  }, [router]);

  // ---------------------------------------------------------
  // Derived
  // ---------------------------------------------------------

  const hasSession = Boolean(sessionId);

  // ---------------------------------------------------------
  // Render
  // ---------------------------------------------------------

  return (
    <CollectorShell
      title="Today's Benchmark"
      subtitle={hydrated ? (hasSession ? `Session: ${sessionId}` : 'No active session') : 'Loading...'}
      footer={
        <div className="space-y-3">
          <PrimaryButton onClick={handleCreate}>
            {hasSession ? 'New Session' : "Create Today's Session"}
          </PrimaryButton>
          {hasSession && (
            <>
              <SecondaryButton onClick={handleExport}>
                Export today.json
              </SecondaryButton>
              <SecondaryButton onClick={() => router.push('/analysis')}>
                View Analysis
              </SecondaryButton>
            </>
          )}
        </div>
      }
    >
      <div className="flex h-full flex-col gap-4">
        {/* Session overview card */}
        {hasSession && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Date</p>
                <p className="text-lg font-semibold text-slate-100">{date}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">Overall</p>
                <p className="text-lg font-semibold text-sky-400">{progress.percent}%</p>
              </div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-sky-500 transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>
                {questions.length} questions · {competitors.length} competitors
              </span>
              <span>
                {progress.completedSteps} / {progress.totalSteps} steps
              </span>
            </div>
          </div>
        )}

        {/* Competitor cards */}
        {cards.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Competitors</p>
            {cards.map((card) => {
              const statusColors: Record<string, string> = {
                'completed': 'border-emerald-800/60 bg-emerald-950/20',
                'in-progress': 'border-sky-800/60 bg-sky-950/20',
                'not-started': 'border-slate-800 bg-slate-900/70',
              };
              const statusLabels: Record<string, string> = {
                'completed': 'Completed',
                'in-progress': 'In Progress',
                'not-started': 'Not Started',
              };
              const statusTextColors: Record<string, string> = {
                'completed': 'text-emerald-400',
                'in-progress': 'text-sky-400',
                'not-started': 'text-slate-500',
              };

              const localProgress = card.totalQuestions > 0
                ? Math.round((card.currentQuestionIndex / card.totalQuestions) * 100)
                : 0;

              return (
                <div
                  key={card.name}
                  className={`rounded-2xl border p-4 ${statusColors[card.status]}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-100">{card.name}</p>
                      <p className={`mt-0.5 text-xs font-medium ${statusTextColors[card.status]}`}>
                        {statusLabels[card.status]}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Progress</p>
                      <p className="text-sm font-semibold text-slate-200">
                        {Math.min(card.currentQuestionIndex, card.totalQuestions)} / {card.totalQuestions}
                      </p>
                    </div>
                  </div>

                  {/* Competitor-level progress bar */}
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        card.status === 'completed' ? 'bg-emerald-500' : 'bg-sky-500'
                      }`}
                      style={{ width: `${localProgress}%` }}
                    />
                  </div>

                  {/* Continue button */}
                  <button
                    type="button"
                    onClick={() => handleContinueCompetitor(card.name)}
                    className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-900/80 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 active:scale-[0.98]"
                  >
                    {card.status === 'completed' ? 'Review' : 'Continue'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!hasSession && hydrated && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center">
            <p className="text-sm text-slate-400">No active session</p>
            <p className="mt-2 text-sm text-slate-500">
              Create a new session to start today&apos;s benchmark.
            </p>
          </div>
        )}
      </div>
    </CollectorShell>
  );
}
