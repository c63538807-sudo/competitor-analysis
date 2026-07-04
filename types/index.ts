// ============================================================
// Collector Core Data Models
// ============================================================
// All Store, IDB, and export modules use these types.
// Do NOT duplicate type definitions elsewhere.

// -----------------------------------------------------------
// Question
// -----------------------------------------------------------

export type QuestionType = '信息问答' | '创作生成' | '工具类' | '推理分析';

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: '信息问答', label: 'Information' },
  { value: '创作生成', label: 'Creation' },
  { value: '工具类', label: 'Tool' },
  { value: '推理分析', label: 'Reasoning' },
];

export interface Question {
  /** Unique question identifier, e.g. "q1" */
  id: string;
  /** Classification for reporting / analysis grouping */
  type: QuestionType;
  /** The full user prompt text */
  prompt: string;
  /** AIC product feature area this question targets */
  targetFunction?: string;
}

// -----------------------------------------------------------
// Competitor
// -----------------------------------------------------------

export interface Competitor {
  /** Display name, e.g. "Ask AI", "ChatSmith" */
  name: string;
}

// -----------------------------------------------------------
// Answer (question-level, per competitor)
// -----------------------------------------------------------

export interface AnswerEntry {
  /** Question id this answer belongs to */
  questionId: string;
  /** Competitor name this answer is from */
  competitorName: string;
  /** The answer text */
  text: string;
}

// -----------------------------------------------------------
// Screenshot (question-level, per competitor)
// -----------------------------------------------------------

export interface ScreenshotEntry {
  /** Question id this screenshot belongs to */
  questionId: string;
  /** Competitor name this screenshot is from */
  competitorName: string;
  /** Base64-encoded image data (or path / blob URL) */
  data: string;
}

// -----------------------------------------------------------
// Competitor Meta
// -----------------------------------------------------------

export interface CompetitorMeta {
  /** The model used for this competitor's answers, e.g. "GPT-5" */
  modelUsed: string;
  /** Number of free queries remaining/available */
  freeCount: string;
  /** Optional free-text notes */
  notes: string;
}

// -----------------------------------------------------------
// Competitor Status (for Dashboard)
// -----------------------------------------------------------

export type CompetitorStatus = 'not-started' | 'in-progress' | 'completed';

export interface CompetitorCard {
  name: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  status: CompetitorStatus;
  hasMetadata: boolean;
}

// -----------------------------------------------------------
// Progress
// -----------------------------------------------------------

export interface SessionProgress {
  /** Steps completed so far (across all competitors) */
  completedSteps: number;
  /** Total steps in this session (competitors × questions) */
  totalSteps: number;
  /** Progress percentage 0–100 */
  percent: number;
}

// -----------------------------------------------------------
// Session (the single source of truth)
// -----------------------------------------------------------

export interface Session {
  /** Unique session key, e.g. "session-2026-07-03" */
  sessionId: string | null;
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Today's questions */
  questions: Question[];
  /** Ordered list of competitor names for this session */
  competitors: string[];
  /** Per-competitor current question index (0-based). */
  competitorQuestionIndices: Record<string, number>;
  /** answers[competitor][questionId] = answer text */
  answers: Record<string, Record<string, string>>;
  /** screenshots[competitor][questionId] = base64 data */
  screenshots: Record<string, Record<string, string>>;
  /** metadata[competitor] = { modelUsed, freeCount, notes } */
  metadata: Record<string, CompetitorMeta>;
  /** Derived progress snapshot */
  progress: SessionProgress;
  /** True when all competitors are finished */
  completed: boolean;
}

// -----------------------------------------------------------
// Export Payload (matches docs/data_model.md)
// -----------------------------------------------------------

export interface ExportQuestion {
  questionIndex: number;
  question: string;
  questionType: QuestionType;
  targetFunction: string;
  aic: {
    answer: string;
    screenshot: string;
    evaluation: string;
  };
  competitors: ExportCompetitorAnswer[];
  competitorEvaluation: string;
  overallJudgment: string;
  notes: string;
}

export interface ExportCompetitorAnswer {
  name: string;
  answer: string;
  screenshot: string;
}

export interface ExportCompetitorMeta {
  name: string;
  freeCount: number;
  model: string;
}

export interface ExportPayload {
  date: string;
  questions: ExportQuestion[];
  competitorMeta: ExportCompetitorMeta[];
}
