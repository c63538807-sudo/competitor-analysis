'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import CollectorShell from '@/components/collector-shell';
import PrimaryButton from '@/components/primary-button';
import SecondaryButton from '@/components/secondary-button';
import { useSessionStore } from '@/store/session-store';
import {
  validateSession,
  buildExportPayload,
  downloadJSON,
} from '@/lib/exporter';

interface ApiResult {
  success: boolean;
  date: string;
  summary: { aicWins: number; competitorWins: number; ties: number; overall: string };
  questions: Array<{ index: number; question: string; type: string; verdict: string; scores: Array<{ name: string; score: number; summary: string }> }>;
  files: { analysisJson: string; dailyReport: string; excelTemplate1: string; excelTemplate2: string };
}

function downloadBase64(base64: string, filename: string, mime: string) {
  const blob = new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export default function ExportPage() {
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);
  const [apiResult, setApiResult] = useState<ApiResult | null>(null);
  const [apiError, setApiError] = useState('');

  const sessionId = useSessionStore((s) => s.sessionId);
  const date = useSessionStore((s) => s.date);
  const questions = useSessionStore((s) => s.questions);
  const competitors = useSessionStore((s) => s.competitors);
  const competitorQuestionIndices = useSessionStore((s) => s.competitorQuestionIndices);
  const answers = useSessionStore((s) => s.answers);
  const screenshots = useSessionStore((s) => s.screenshots);
  const metadata = useSessionStore((s) => s.metadata);
  const completed = useSessionStore((s) => s.completed);
  const progress = useSessionStore((s) => s.progress);

  const session = useMemo(() => ({
    sessionId, date, questions, competitors, competitorQuestionIndices,
    answers, screenshots, metadata, progress, completed,
  }), [sessionId, date, questions, competitors, competitorQuestionIndices, answers, screenshots, metadata, progress, completed]);

  const validation = useMemo(() => validateSession(session), [session]);

  // --- Download today.json (local export, no analysis) ---
  const handleLocalExport = () => {
    const payload = buildExportPayload(session);
    downloadJSON(payload, `today-${date}.json`);
  };

  // --- API: Run full analysis ---
  const handleAnalyze = async () => {
    setAnalyzing(true);
    setApiError('');
    try {
      const payload = buildExportPayload(session);
      const resp = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!data.success) { setApiError(data.error || data.message); return; }
      setApiResult(data);
    } catch (e) {
      setApiError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <CollectorShell
      title="Export & Analyze"
      subtitle={sessionId ? `${sessionId}` : 'No session'}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <SecondaryButton onClick={() => router.push('/')}>Dashboard</SecondaryButton>
          <PrimaryButton onClick={handleAnalyze} disabled={!validation.valid || analyzing}>
            {analyzing ? 'Analyzing...' : 'Export & Analyze'}
          </PrimaryButton>
        </div>
      }
    >
      <div className="flex h-full flex-col gap-4 overflow-y-auto">
        {/* Validation summary */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">{questions.length} questions</span>
            <span className="text-slate-400">{competitors.length} competitors</span>
            <span className={validation.valid ? 'text-emerald-400' : 'text-amber-400'}>
              {validation.valid ? '✓ Ready' : `${validation.issues.length} issues`}
            </span>
          </div>
        </div>

        {/* Local export */}
        <button onClick={handleLocalExport} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-300 hover:border-slate-500">
          💾 Download today.json only
        </button>

        {/* Errors */}
        {apiError && (
          <div className="rounded-2xl border border-red-800/60 bg-red-950/30 p-4 text-sm text-red-400">{apiError}</div>
        )}

        {/* Analysis Results */}
        {apiResult && (
          <div className="space-y-3">
            {/* Summary */}
            <div className="rounded-2xl border border-emerald-800/60 bg-emerald-950/20 p-4">
              <p className="text-sm font-semibold text-emerald-300">Analysis Complete</p>
              <p className="mt-1 text-xs text-slate-400">
                🏆 {apiResult.summary.aicWins}W ⚠️ {apiResult.summary.competitorWins}L 🤝 {apiResult.summary.ties}T
              </p>
              <p className="mt-1 text-xs text-slate-300">{apiResult.summary.overall}</p>
            </div>

            {/* Download buttons */}
            <div className="space-y-2">
              <button onClick={() => downloadBase64(apiResult.files.analysisJson, `analysis_${apiResult.date}.json`, 'application/json')} className="w-full rounded-xl border border-sky-800/60 bg-sky-950/20 p-3 text-left text-sm text-sky-300 hover:bg-sky-950/40">
                📊 Download Analysis JSON
              </button>
              <button onClick={() => downloadBase64(apiResult.files.dailyReport, `daily_report_${apiResult.date}.md`, 'text/markdown')} className="w-full rounded-xl border border-sky-800/60 bg-sky-950/20 p-3 text-left text-sm text-sky-300 hover:bg-sky-950/40">
                📝 Download Daily Report (.md)
              </button>
              <button onClick={() => downloadBase64(apiResult.files.excelTemplate1, `竞品对比_${apiResult.date}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')} className="w-full rounded-xl border border-emerald-800/60 bg-emerald-950/20 p-3 text-left text-sm text-emerald-300 hover:bg-emerald-950/40">
                📈 Download 竞品对比 Excel
              </button>
              <button onClick={() => downloadBase64(apiResult.files.excelTemplate2, `具体问答_${apiResult.date}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')} className="w-full rounded-xl border border-emerald-800/60 bg-emerald-950/20 p-3 text-left text-sm text-emerald-300 hover:bg-emerald-950/40">
                📋 Download 具体问答 Excel
              </button>
              <button onClick={() => router.push('/analysis')} className="w-full rounded-xl border border-slate-700 bg-slate-900/50 p-3 text-sm text-slate-400 hover:bg-slate-900/70">
                View in Analysis Page →
              </button>
            </div>
          </div>
        )}
      </div>
    </CollectorShell>
  );
}
