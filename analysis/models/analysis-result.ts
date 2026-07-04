// ============================================================
// Analysis Engine — Unified Result Model
// ============================================================
// This is the SINGLE data structure that every Analysis Agent
// reads from and writes to.
//
// Sprint 2 (Quality Review) → fills questions[].reviews
// Sprint N (Comparison)      → fills questions[].comparison
// Sprint N (Judgment)        → fills questions[].judgment
// Sprint N (Suggestion)      → fills questions[].suggestion
// Sprint N (Fact Check)      → fills questions[].factCheck
// Sprint N (Summary)         → fills summary
//
// No other result types should be created.
// ============================================================

import type { ReviewResult } from '../quality-review/types';
import type { FactCheckResult as FCResult } from '../fact-check/types';

// Re-export for convenience
export type FactCheckResult = FCResult;

// -----------------------------------------------------------
// Question-level placeholders (filled by future sprints)
// -----------------------------------------------------------

/** Filled by Comparison Agent. */
export interface ComparisonResult {
  /** Answerers ranked by totalScore (best first). */
  ranking: { answererName: string; rank: number; totalScore: number }[];
  /** Full score breakdown per answerer. */
  scoreTable: {
    answererName: string;
    totalScore: number;
    dimensions: Record<string, number>;
  }[];
  /** Per-dimension comparison across all answerers. */
  dimensionComparison: {
    dimension: string;
    label: string;
    scores: Record<string, number>;
    leader: string;
  }[];
  /** Dimensions where the gap between top two is ≥ 2 points. */
  keyDifferences: {
    dimension: string;
    label: string;
    leader: string;
    gap: number;
    description: string;
  }[];
  /** Objective factual summary (no winner declaration). */
  analysisSummary: string;
}

/** Filled by Judgment Agent. */
export interface JudgmentResult {
  /** Which answerer wins: "AIC", a competitor name, or "—" for tie. */
  winner: string;
  /** Canonical result label. */
  result: 'AIC Better' | 'Competitor Better' | 'Tie';
  /** How confident the judgment is. */
  confidence: 'High' | 'Medium' | 'Low';
  /** Score gap: AIC totalScore − best competitor totalScore. */
  scoreGap: number;
  /** Detailed reasons (1–3 bullet points). */
  reasons: string[];
}

/** Filled by Suggestion Agent. */
export interface SuggestionResult {
  /** Whether a suggestion is needed at all. */
  required: boolean;
  /** How urgent the improvement is. */
  priority: 'High' | 'Medium' | 'Low';
  /** Which areas need improvement (1–3 labels). */
  improvementAreas: string[];
  /** Concrete, actionable steps (1–3 items). */
  actionItems: string[];
  /** One-sentence summary (Chinese). */
  summary: string;
}

// -----------------------------------------------------------
// Question Result
// -----------------------------------------------------------

/** Per-question analysis result. All answers for this question live here. */
export interface QuestionResult {
  questionIndex: number;
  question: string;
  questionType: string;
  targetFunction: string;

  /** Filled by Quality Review (Sprint 2). One entry per answerer. */
  reviews: ReviewResult[];

  /** Filled by Comparison Agent (future). Null until then. */
  comparison: ComparisonResult | null;

  /** Filled by Judgment Agent (future). Null until then. */
  judgment: JudgmentResult | null;

  /** Filled by Suggestion Agent (future). Null until then. */
  suggestion: SuggestionResult | null;

  /** Filled by Fact Check Agent (future). Null until then. */
  factCheck: FactCheckResult | null;
}

// -----------------------------------------------------------
// Session Summary (placeholder for Summary Agent)
// -----------------------------------------------------------

export interface AnalysisSummary {
  /** Overall assessment paragraph (100–200 chars Chinese). */
  overallAssessment: string;

  /** AIC strengths across all questions. */
  strengths: string[];

  /** AIC weaknesses across all questions. */
  weaknesses: string[];

  /** Per-competitor insights. */
  competitorInsights: Record<string, string>;

  /** Win/loss/tie counts. */
  winLossSummary: {
    aicWins: number;
    competitorWins: number;
    ties: number;
    details: string;
  };

  /** Top 3 optimization recommendations. */
  recommendations: string[];
}

// -----------------------------------------------------------
// Top-level Analysis Result
// -----------------------------------------------------------

export interface AnalysisResult {
  /** Session metadata. */
  session: {
    date: string;
    questionCount: number;
    competitorCount: number;
    competitorNames: string[];
    competitorMeta: { name: string; freeCount: number; model: string }[];
  };

  /** Per-question results. Index 0 = question 1. */
  questions: QuestionResult[];

  /** Cross-question summary. Filled by Summary Agent (future). */
  summary: AnalysisSummary;
}

// -----------------------------------------------------------
// Factory
// -----------------------------------------------------------

/** Create an empty AnalysisResult shell for a given session. */
export function createEmptyResult(
  date: string,
  questions: { questionIndex: number; question: string; questionType: string; targetFunction: string }[],
  competitorNames: string[],
  competitorMeta: { name: string; freeCount: number; model: string }[],
): AnalysisResult {
  return {
    session: {
      date,
      questionCount: questions.length,
      competitorCount: competitorNames.length,
      competitorNames,
      competitorMeta,
    },
    questions: questions.map((q) => ({
      questionIndex: q.questionIndex,
      question: q.question,
      questionType: q.questionType,
      targetFunction: q.targetFunction,
      reviews: [],
      comparison: null,
      judgment: null,
      suggestion: null,
      factCheck: null,
    })),
    summary: {
      overallAssessment: '',
      strengths: [],
      weaknesses: [],
      competitorInsights: {},
      winLossSummary: { aicWins: 0, competitorWins: 0, ties: 0, details: '' },
      recommendations: [],
    },
  };
}
