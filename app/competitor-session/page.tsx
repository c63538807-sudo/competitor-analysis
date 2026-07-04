'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, Suspense } from 'react';
import CollectorShell from '@/components/collector-shell';
import PrimaryButton from '@/components/primary-button';
import SecondaryButton from '@/components/secondary-button';
import ScreenshotManager from '@/components/screenshot-manager';
import { useSessionStore } from '@/store/session-store';
import { QUESTION_TYPES } from '@/types';

function CompetitorSessionInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const competitor = searchParams.get('c') ?? '';

  const questions = useSessionStore((state) => state.questions);
  const competitors = useSessionStore((state) => state.competitors);
  const competitorQuestionIndices = useSessionStore((state) => state.competitorQuestionIndices);
  const answers = useSessionStore((state) => state.answers);
  const screenshots = useSessionStore((state) => state.screenshots);
  const setCompetitorQuestionIndex = useSessionStore((state) => state.setCompetitorQuestionIndex);
  const updateAnswer = useSessionStore((state) => state.updateAnswer);
  const updateScreenshot = useSessionStore((state) => state.updateScreenshot);
  const removeScreenshot = useSessionStore((state) => state.removeScreenshot);

  // ---------------------------------------------------------
  // Guard: no competitor specified → back to home
  // ---------------------------------------------------------
  useEffect(() => {
    if (!competitor || !competitors.includes(competitor)) {
      router.replace('/');
    }
  }, [competitor, competitors, router]);

  // ---------------------------------------------------------
  // Per-competitor position
  // ---------------------------------------------------------
  const currentIdx = competitor
    ? (competitorQuestionIndices[competitor] ?? 0)
    : 0;
  const currentQuestion = questions[currentIdx] ?? null;
  const currentAnswer =
    competitor && currentQuestion
      ? (answers[competitor]?.[currentQuestion.id] ?? '')
      : '';
  const currentScreenshot =
    competitor && currentQuestion
      ? (screenshots[competitor]?.[currentQuestion.id] ?? '')
      : '';

  const totalQuestions = questions.length;

  // ---------------------------------------------------------
  // Auto-save clock (cosmetic)
  // ---------------------------------------------------------
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  useEffect(() => {
    const unsub = useSessionStore.subscribe(() => setLastSaved(Date.now()));
    return () => unsub();
  }, []);
  const [secondsAgo, setSecondsAgo] = useState(0);
  useEffect(() => {
    if (lastSaved === null) return;
    const timer = setInterval(() => {
      setSecondsAgo(Math.round((Date.now() - lastSaved) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastSaved]);

  // ---------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------
  const handlePrevious = useCallback(() => {
    if (currentIdx > 0) {
      setCompetitorQuestionIndex(competitor, currentIdx - 1);
    }
  }, [competitor, currentIdx, setCompetitorQuestionIndex]);

  const handleNext = useCallback(() => {
    if (currentIdx >= totalQuestions - 1) {
      // Last question → go to metadata for this competitor
      router.push(`/metadata?c=${encodeURIComponent(competitor)}`);
      return;
    }
    setCompetitorQuestionIndex(competitor, currentIdx + 1);
  }, [competitor, currentIdx, totalQuestions, setCompetitorQuestionIndex, router]);

  const handleBackToDashboard = useCallback(() => {
    router.push('/');
  }, [router]);

  // ---------------------------------------------------------
  // Type label lookup
  // ---------------------------------------------------------
  const typeLabel =
    currentQuestion?.type
      ? (QUESTION_TYPES.find((qt) => qt.value === currentQuestion.type)?.label ?? currentQuestion.type)
      : '—';

  // ---------------------------------------------------------
  // Render
  // ---------------------------------------------------------
  if (!competitor || !currentQuestion) {
    return (
      <CollectorShell title="Loading..." subtitle="Redirecting to dashboard">
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </CollectorShell>
    );
  }

  return (
    <CollectorShell
      title={competitor}
      subtitle={`Question ${Math.min(currentIdx + 1, totalQuestions)} / ${totalQuestions}`}
    >
      <div className="flex h-full flex-col gap-4">
        {/* Progress bar */}
        <div className="rounded-[24px] border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>Progress</span>
            <span>
              {totalQuestions > 0
                ? Math.round((currentIdx / totalQuestions) * 100)
                : 0}%
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-sky-500 transition-all duration-300"
              style={{
                width: `${totalQuestions > 0 ? Math.round((currentIdx / totalQuestions) * 100) : 0}%`,
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleBackToDashboard}
            className="mt-3 text-xs text-slate-500 transition hover:text-slate-300"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Scrollable: question + answer + screenshot */}
        <div className="flex-1 overflow-y-auto rounded-[24px] border border-slate-800 bg-slate-950/70 p-4">
          {/* Question type */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Type</p>
            <p className="mt-1 text-sm font-semibold text-sky-400">{typeLabel}</p>
          </div>

          {/* Question text */}
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Question</p>
            <p className="mt-2 text-[17px] leading-7 text-slate-100">
              {currentQuestion.prompt}
            </p>
          </div>

          {/* Answer */}
          <div className="mt-6 rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-100">Answer</p>
              <p className="text-xs text-slate-500">Required</p>
            </div>
            <textarea
              value={currentAnswer}
              onChange={(event) =>
                updateAnswer(competitor, currentQuestion.id, event.target.value)
              }
              className="min-h-[140px] w-full resize-none rounded-[18px] border border-slate-700 bg-slate-950/80 px-3 py-3 text-sm leading-6 text-slate-100 outline-none ring-0 placeholder:text-slate-500"
              placeholder="Paste competitor answer here..."
            />
          </div>

          {/* Screenshot */}
          <div className="mt-4">
            <ScreenshotManager
              screenshot={currentScreenshot}
              onScreenshotChange={(base64) =>
                updateScreenshot(competitor, currentQuestion.id, base64)
              }
              onScreenshotRemove={() =>
                removeScreenshot(competitor, currentQuestion.id)
              }
            />
          </div>
        </div>

        {/* Bottom: auto-save + navigation */}
        <div className="space-y-3">
          <div className="rounded-[20px] border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-400">
            <div className="flex items-center justify-between">
              <span>Auto Save</span>
              <span className="text-slate-300">
                {lastSaved === null
                  ? 'Watching...'
                  : secondsAgo <= 1
                    ? 'Saved just now'
                    : `Saved ${secondsAgo}s ago`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SecondaryButton onClick={handlePrevious} disabled={currentIdx === 0}>
              Previous
            </SecondaryButton>
            <PrimaryButton onClick={handleNext}>
              {currentIdx >= totalQuestions - 1 ? 'Finish Questions' : 'Next'}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </CollectorShell>
  );
}

// Wrap in Suspense because useSearchParams requires it
export default function CompetitorSessionPage() {
  return (
    <Suspense fallback={null}>
      <CompetitorSessionInner />
    </Suspense>
  );
}
