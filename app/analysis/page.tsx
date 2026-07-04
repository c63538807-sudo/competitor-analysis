'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CollectorShell from '@/components/collector-shell';

interface AnalysisData {
  session: { date: string; questionCount: number; competitorNames: string[] };
  questions: Array<{
    questionIndex: number; question: string; questionType: string;
    reviews: Array<{ answererName: string; totalScore: number; shortSummary: string }>;
    judgment: { result: string; winner: string; scoreGap: number; confidence: string } | null;
    suggestion: { required: boolean; improvementAreas: string[]; summary: string } | null;
    factCheck: { result: string; claims: Array<{ status: string; text: string }> } | null;
  }>;
  summary: {
    overallAssessment: string; strengths: string[]; weaknesses: string[];
    winLossSummary: { aicWins: number; competitorWins: number; ties: number };
    recommendations: string[];
  };
}

export default function AnalysisPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalysisData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/analysis_result.json')
      .then((r) => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(setData)
      .catch(() => setError('No analysis result found. Run the pipeline first.'));
  }, []);

  if (error) {
    return (
      <CollectorShell title="Analysis" subtitle="Benchmark Results" footer={<button onClick={() => router.push('/')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200">← Dashboard</button>}>
        <div className="flex h-full items-center justify-center">
          <div className="rounded-2xl border border-amber-800/60 bg-amber-950/30 p-6 text-center">
            <p className="text-amber-400 text-lg font-semibold">No Data</p>
            <p className="mt-2 text-sm text-slate-400">{error}</p>
          </div>
        </div>
      </CollectorShell>
    );
  }

  if (!data) {
    return (
      <CollectorShell title="Analysis" subtitle="Loading...">
        <div className="flex h-full items-center justify-center"><p className="text-slate-400">Loading...</p></div>
      </CollectorShell>
    );
  }

  const { session, questions, summary } = data;

  return (
    <CollectorShell
      title="Analysis Results"
      subtitle={`${session.date} · ${session.questionCount} questions · ${session.competitorNames.join(', ')}`}
      footer={<button onClick={() => router.push('/')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200">← Dashboard</button>}
    >
      <div className="flex h-full flex-col gap-4 overflow-y-auto">
        {/* Summary Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Result</span>
            <span className="text-sm font-mono">
              🏆 {summary.winLossSummary.aicWins}W ⚠️ {summary.winLossSummary.competitorWins}L 🤝 {summary.winLossSummary.ties}T
            </span>
          </div>
          {summary.overallAssessment && (
            <p className="mt-2 text-sm text-slate-300">{summary.overallAssessment}</p>
          )}
        </div>

        {/* Per-question cards */}
        {questions.map((q) => {
          const j = q.judgment;
          const emoji = j?.result === 'AIC Better' ? '🏆' : j?.result === 'Competitor Better' ? '⚠️' : '🤝';
          const bgColor = j?.result === 'AIC Better' ? 'border-emerald-800/60 bg-emerald-950/20'
            : j?.result === 'Competitor Better' ? 'border-red-800/60 bg-red-950/20'
            : 'border-amber-800/60 bg-amber-950/20';

          return (
            <div key={q.questionIndex} className={`rounded-2xl border p-4 ${bgColor}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Q{q.questionIndex} · {q.questionType}</span>
                <span className="text-sm font-semibold">{emoji} {j?.result ?? 'N/A'}</span>
              </div>
              <p className="mt-2 text-sm text-slate-200">{q.question}</p>

              {/* Scores */}
              <div className="mt-3 space-y-1">
                {q.reviews.slice(0, 5).map((r) => (
                  <div key={r.answererName} className="flex justify-between text-xs">
                    <span className="text-slate-400">{r.answererName}</span>
                    <span className="text-slate-300 font-mono">{r.totalScore}</span>
                  </div>
                ))}
              </div>

              {/* Fact Check */}
              {q.factCheck && q.factCheck.claims.length > 0 && (
                <div className="mt-2 text-xs text-slate-400">
                  FC: {q.factCheck.result} ({q.factCheck.claims.length} claims)
                </div>
              )}

              {/* Suggestion */}
              {q.suggestion?.required && (
                <div className="mt-2 text-xs text-amber-400">
                  {q.suggestion.summary}
                </div>
              )}
            </div>
          );
        })}

        {/* Strengths & Weaknesses */}
        {(summary.strengths.length > 0 || summary.weaknesses.length > 0) && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            {summary.strengths.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-medium text-emerald-400">Strengths</p>
                {summary.strengths.map((s, i) => <p key={i} className="text-xs text-slate-300 mt-1">• {s}</p>)}
              </div>
            )}
            {summary.weaknesses.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-400">Weaknesses</p>
                {summary.weaknesses.map((w, i) => <p key={i} className="text-xs text-slate-300 mt-1">• {w}</p>)}
              </div>
            )}
          </div>
        )}

        {/* Recommendations */}
        {summary.recommendations.length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs font-medium text-sky-400">Recommendations</p>
            {summary.recommendations.map((r, i) => <p key={i} className="text-xs text-slate-300 mt-1">• {r}</p>)}
          </div>
        )}
      </div>
    </CollectorShell>
  );
}
