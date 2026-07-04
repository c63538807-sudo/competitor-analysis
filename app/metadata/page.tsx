'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import CollectorShell from '@/components/collector-shell';
import PrimaryButton from '@/components/primary-button';
import SecondaryButton from '@/components/secondary-button';
import { useSessionStore } from '@/store/session-store';

function MetadataInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const competitor = searchParams.get('c') ?? '';

  const competitors = useSessionStore((state) => state.competitors);
  const questions = useSessionStore((state) => state.questions);
  const competitorQuestionIndices = useSessionStore((state) => state.competitorQuestionIndices);
  const metadata = useSessionStore((state) => state.metadata);
  const updateMetadata = useSessionStore((state) => state.updateMetadata);
  const setCompetitorQuestionIndex = useSessionStore((state) => state.setCompetitorQuestionIndex);
  const finishSession = useSessionStore((state) => state.finishSession);

  // Guard
  useEffect(() => {
    if (!competitor || !competitors.includes(competitor)) {
      router.replace('/');
    }
  }, [competitor, competitors, router]);

  const currentMetadata = metadata[competitor] ?? { modelUsed: '', freeCount: '', notes: '' };

  // ---------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------

  const handleFinish = () => {
    // Mark this competitor's questions as complete
    setCompetitorQuestionIndex(competitor, questions.length);
    finishSession();
    router.push('/');
  };

  const handleBack = () => {
    router.push(`/competitor-session?c=${encodeURIComponent(competitor)}`);
  };

  // ---------------------------------------------------------
  // Render
  // ---------------------------------------------------------

  if (!competitor) {
    return null;
  }

  return (
    <CollectorShell
      title="Metadata"
      subtitle={`Model & usage info for ${competitor}`}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <SecondaryButton onClick={handleBack}>Back</SecondaryButton>
          <PrimaryButton onClick={handleFinish}>Finish &amp; Return</PrimaryButton>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <span className="mb-2 block text-sm text-slate-400">Model Used</span>
          <input
            value={currentMetadata.modelUsed}
            onChange={(event) =>
              updateMetadata(competitor, { modelUsed: event.target.value })
            }
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            placeholder="GPT-4o"
          />
        </label>

        <label className="block rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <span className="mb-2 block text-sm text-slate-400">Free Count</span>
          <input
            value={currentMetadata.freeCount}
            onChange={(event) =>
              updateMetadata(competitor, { freeCount: event.target.value })
            }
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            placeholder="3"
          />
        </label>

        <label className="block rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <span className="mb-2 block text-sm text-slate-400">Notes</span>
          <textarea
            value={currentMetadata.notes}
            onChange={(event) =>
              updateMetadata(competitor, { notes: event.target.value })
            }
            className="min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            placeholder="Optional notes"
          />
        </label>
      </div>
    </CollectorShell>
  );
}

export default function MetadataPage() {
  return (
    <Suspense fallback={null}>
      <MetadataInner />
    </Suspense>
  );
}
