'use client';

import { useRouter } from 'next/navigation';
import { useState, useMemo, useCallback } from 'react';
import CollectorShell from '@/components/collector-shell';
import PrimaryButton from '@/components/primary-button';
import SecondaryButton from '@/components/secondary-button';
import { useSessionStore } from '@/store/session-store';
import { QUESTION_TYPES, type Question, type QuestionType } from '@/types';

const MAX_QUESTIONS = 20;

function parseQuestions(raw: string, types: Record<number, QuestionType>): Question[] {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.slice(0, MAX_QUESTIONS).map((prompt, index) => ({
    id: `q${index + 1}`,
    type: types[index] ?? '信息问答',
    prompt,
  }));
}

export default function ImportPage() {
  const router = useRouter();
  const createSession = useSessionStore((state) => state.createSession);

  // --- Wizard step ---
  const [step, setStep] = useState<1 | 2>(1);

  // --- Step 1: Questions ---
  const [rawText, setRawText] = useState('');
  const [questionTypes, setQuestionTypes] = useState<Record<number, QuestionType>>({});

  const lineCount = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0).length;

  const overLimit = lineCount > MAX_QUESTIONS;
  const questions = useMemo(
    () => parseQuestions(rawText, questionTypes),
    [rawText, questionTypes],
  );
  const canNextStep = questions.length >= 1;

  const setQuestionType = useCallback((index: number, type: QuestionType) => {
    setQuestionTypes((prev) => ({ ...prev, [index]: type }));
  }, []);

  // --- Step 2: Competitors ---
  const [comp1, setComp1] = useState('');
  const [comp2, setComp2] = useState('');
  const [comp3, setComp3] = useState('');

  const competitorNames = [comp1, comp2, comp3]
    .map((n) => n.trim())
    .filter((n) => n.length > 0);

  const canCreate = competitorNames.length >= 1;

  // --- Handlers ---
  const handleCreate = useCallback(() => {
    if (!canCreate || !canNextStep) return;

    // Ensure all questions have a type (default if not set)
    const finalQuestions = questions.map((q, i) => ({
      ...q,
      type: questionTypes[i] ?? '信息问答' as QuestionType,
    }));

    createSession(finalQuestions, competitorNames);
    router.push('/');
  }, [canCreate, canNextStep, questions, questionTypes, competitorNames, createSession, router]);

  // --- Render ---
  return (
    <CollectorShell
      title="Create Today's Session"
      subtitle={step === 1 ? 'Step 1: Import Questions' : 'Step 2: Competitors'}
      footer={
        step === 1 ? (
          <PrimaryButton onClick={() => setStep(2)} disabled={!canNextStep}>
            Next — {questions.length} Question{questions.length !== 1 ? 's' : ''}
          </PrimaryButton>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <SecondaryButton onClick={() => setStep(1)}>Back</SecondaryButton>
            <PrimaryButton onClick={handleCreate} disabled={!canCreate}>
              Create Today's Session
            </PrimaryButton>
          </div>
        )
      }
    >
      {step === 1 ? (
        /* ================================================================
           Step 1 — Questions + Types
           ================================================================ */
        <div className="flex h-full flex-col gap-4">
          {/* Paste area */}
          <div className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-100">Paste Questions</p>
              <p className="text-xs text-slate-500">One per line</p>
            </div>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="min-h-[130px] w-full resize-y rounded-[18px] border border-slate-700 bg-slate-950/80 px-3 py-3 text-sm leading-6 text-slate-100 outline-none ring-0 placeholder:text-slate-500"
              placeholder={`2025年诺贝尔物理学奖授予了谁？\n帮我写一份英文简历\n翻译这段话成日语`}
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {lineCount} line{lineCount !== 1 ? 's' : ''}
              </span>
              {overLimit && (
                <span className="text-xs font-medium text-amber-400">
                  Showing first {MAX_QUESTIONS}
                </span>
              )}
            </div>
          </div>

          {/* Preview with type selectors */}
          <div className="flex-1 overflow-y-auto rounded-[22px] border border-slate-800 bg-slate-950/70 p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500">
              Preview &amp; Set Types ({questions.length} question{questions.length !== 1 ? 's' : ''})
            </p>

            {questions.length === 0 ? (
              <div className="flex h-32 items-center justify-center">
                <span className="text-center text-sm text-slate-500">
                  <span className="block text-xl">📋</span>
                  <span className="mt-1 block">Paste questions above</span>
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((question, index) => (
                  <div
                    key={question.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-950/60 text-[11px] font-medium text-sky-400">
                        {index + 1}
                      </span>
                      <p className="flex-1 text-sm leading-5 text-slate-200">
                        {question.prompt}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">Type:</span>
                      <select
                        value={questionTypes[index] ?? '信息问答'}
                        onChange={(e) =>
                          setQuestionType(index, e.target.value as QuestionType)
                        }
                        className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 outline-none"
                      >
                        {QUESTION_TYPES.map((qt) => (
                          <option key={qt.value} value={qt.value}>
                            {qt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ================================================================
           Step 2 — Competitors
           ================================================================ */
        <div className="flex h-full flex-col gap-4">
          <p className="text-sm text-slate-400">
            {questions.length} question{questions.length !== 1 ? 's' : ''} imported.
            Enter up to 3 competitor names.
          </p>

          <div className="space-y-3">
            {[
              { index: 1, value: comp1, setter: setComp1, placeholder: 'Ask AI' },
              { index: 2, value: comp2, setter: setComp2, placeholder: 'ChatSmith' },
              { index: 3, value: comp3, setter: setComp3, placeholder: 'Nova' },
            ].map(({ index, value, setter, placeholder }) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-300">
                    {index}
                  </span>
                  <input
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className="w-full bg-transparent text-sm font-medium text-slate-100 outline-none ring-0 placeholder:text-slate-500"
                    placeholder={placeholder}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500">
            {competitorNames.length === 0
              ? 'Enter at least 1 competitor name.'
              : `${competitorNames.length} competitor${competitorNames.length !== 1 ? 's' : ''} entered`}
          </p>
        </div>
      )}
    </CollectorShell>
  );
}
