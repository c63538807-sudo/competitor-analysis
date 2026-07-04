'use client';

import { create } from 'zustand';
import { saveSession } from '@/lib/idb';
import type { Session, Question, CompetitorMeta, SessionProgress } from '@/types';

// ============================================================
// Helpers
// ============================================================

function computeProgress(state: SessionState): SessionProgress {
  const totalSteps = state.competitors.length * state.questions.length;
  if (totalSteps === 0) {
    return { completedSteps: 0, totalSteps: 0, percent: 0 };
  }

  let completedSteps = 0;
  for (const competitor of state.competitors) {
    const idx = state.competitorQuestionIndices[competitor] ?? 0;
    completedSteps += Math.min(idx, state.questions.length);
  }

  return {
    completedSteps,
    totalSteps,
    percent: Math.round((completedSteps / totalSteps) * 100),
  };
}

function isSessionComplete(state: SessionState): boolean {
  if (state.competitors.length === 0 || state.questions.length === 0) return false;
  return state.competitors.every(
    (c) => (state.competitorQuestionIndices[c] ?? 0) >= state.questions.length,
  );
}

const createBlankSession = (): Session => ({
  sessionId: null,
  date: '',
  questions: [],
  competitors: [],
  competitorQuestionIndices: {},
  answers: {},
  screenshots: {},
  metadata: {},
  progress: { completedSteps: 0, totalSteps: 0, percent: 0 },
  completed: false,
});

function pickSession(state: SessionState & SessionActions): Session {
  return {
    sessionId: state.sessionId,
    date: state.date,
    questions: state.questions,
    competitors: state.competitors,
    competitorQuestionIndices: state.competitorQuestionIndices,
    answers: state.answers,
    screenshots: state.screenshots,
    metadata: state.metadata,
    progress: state.progress,
    completed: state.completed,
  };
}

// ============================================================
// Types
// ============================================================

type SessionState = Session;

type SessionActions = {
  /** Overwrite the entire store with a previously-saved Session (from IDB). */
  restoreSession: (session: Session) => void;
  /** Create today's session with the given questions and competitors. */
  createSession: (questions: Question[], competitors: string[]) => void;
  /** Set the current question index for a specific competitor. */
  setCompetitorQuestionIndex: (competitor: string, index: number) => void;
  /** Persist the answer text for a given competitor + question. */
  updateAnswer: (competitor: string, questionId: string, answer: string) => void;
  /** Patch metadata for a specific competitor. */
  updateMetadata: (competitor: string, patch: Partial<CompetitorMeta>) => void;
  /** Persist a screenshot (base64) for a given competitor + question. */
  updateScreenshot: (competitor: string, questionId: string, screenshotBase64: string) => void;
  /** Remove the screenshot for a given competitor + question. */
  removeScreenshot: (competitor: string, questionId: string) => void;
  /** Mark the entire session as completed. */
  finishSession: () => void;
};

// ============================================================
// Store
// ============================================================

export const useSessionStore = create<SessionState & SessionActions>((set) => ({
  ...createBlankSession(),

  // -------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------

  restoreSession: (session) => {
    set(() => ({ ...session }));
  },

  createSession: (questions, competitors) => {
    if (questions.length === 0 || competitors.length === 0) return;

    const today = new Date().toISOString().slice(0, 10);
    const indices: Record<string, number> = {};
    for (const c of competitors) {
      indices[c] = 0;
    }

    const base: Session = {
      sessionId: `session-${today}`,
      date: today,
      questions,
      competitors,
      competitorQuestionIndices: indices,
      answers: {},
      screenshots: {},
      metadata: {},
      progress: { completedSteps: 0, totalSteps: 0, percent: 0 },
      completed: false,
    };

    set(() => ({
      ...base,
      progress: computeProgress(base),
    }));
  },

  // -------------------------------------------------------
  // Per-competitor question navigation
  // -------------------------------------------------------

  setCompetitorQuestionIndex: (competitor, index) => {
    set((state) => {
      if (!state.competitors.includes(competitor)) return state;
      const clamped = Math.max(0, Math.min(index, state.questions.length));

      const nextIndices = {
        ...state.competitorQuestionIndices,
        [competitor]: clamped,
      };

      const nextState = {
        ...state,
        competitorQuestionIndices: nextIndices,
      };

      return {
        ...nextState,
        progress: computeProgress(nextState),
        completed: isSessionComplete(nextState),
      };
    });
  },

  // -------------------------------------------------------
  // Data entry
  // -------------------------------------------------------

  updateAnswer: (competitor, questionId, answer) => {
    set((state) => {
      const nextAnswers = {
        ...state.answers,
        [competitor]: {
          ...(state.answers[competitor] ?? {}),
          [questionId]: answer,
        },
      };
      return { ...state, answers: nextAnswers };
    });
  },

  updateMetadata: (competitor, patch) => {
    set((state) => ({
      ...state,
      metadata: {
        ...state.metadata,
        [competitor]: {
          ...(state.metadata[competitor] ?? { modelUsed: '', freeCount: '', notes: '' }),
          ...patch,
        },
      },
    }));
  },

  updateScreenshot: (competitor, questionId, screenshotBase64) => {
    set((state) => {
      const nextScreenshots = {
        ...state.screenshots,
        [competitor]: {
          ...(state.screenshots[competitor] ?? {}),
          [questionId]: screenshotBase64,
        },
      };
      return { ...state, screenshots: nextScreenshots };
    });
  },

  removeScreenshot: (competitor, questionId) => {
    set((state) => {
      const competitorScreenshots = state.screenshots[competitor];
      if (!competitorScreenshots) return state;

      const { [questionId]: _, ...rest } = competitorScreenshots;

      return {
        ...state,
        screenshots: {
          ...state.screenshots,
          [competitor]: rest,
        },
      };
    });
  },

  // -------------------------------------------------------
  // Session lifecycle
  // -------------------------------------------------------

  finishSession: () => {
    set((state) => ({
      ...state,
      completed: true,
      progress: computeProgress({ ...state, completed: true } as SessionState),
    }));
  },
}));

// ============================================================
// Auto-save to IndexedDB (debounced)
// ============================================================

let saveTimer: ReturnType<typeof setTimeout> | null = null;

useSessionStore.subscribe((state) => {
  if (!state.sessionId) return;

  if (saveTimer) clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    const session = pickSession(state);
    saveSession(session);
  }, 500);
});
