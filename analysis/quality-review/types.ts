// ============================================================
// Quality Review — Type Definitions
// ============================================================

/** The six universal evaluation dimensions. */
export type DimensionId =
  | 'completeness'
  | 'professionalism'
  | 'structure'
  | 'practicality'
  | 'naturalness'
  | 'interaction';

/** A single dimension's score + comment. */
export interface DimensionScore {
  /** 1–5 integer score. 0 = not applicable (weight zero). */
  score: number;
  /** Short Chinese comment explaining the score. */
  comment: string;
}

/** Weights applied per question type. */
export type WeightMatrix = Record<DimensionId, number>;

/** Review result for one answer from one product. */
export interface ReviewResult {
  /** Which product this review is for (e.g. "AIC", "Ask AI"). */
  answererName: string;
  /** Weighted total score (0–100). */
  totalScore: number;
  /** Per-dimension scores. */
  dimensions: Record<DimensionId, DimensionScore>;
  /** 1–3 things the answer does well. */
  strengths: string[];
  /** 1–3 things the answer could improve. */
  weaknesses: string[];
  /** One-sentence summary in Chinese. */
  shortSummary: string;
}

/** Optional context passed into reviewAnswer (future Fact Check integration). */
export interface ReviewContext {
  /** Fact Check result — reserved for future Sprint. */
  factCheckResult?: unknown;
  /** Whether accuracy should be penalised (set by Fact Check). */
  factCheckFailed?: boolean;
}

// ============================================================
// Default weight matrices (per question type)
// ============================================================

export const WEIGHT_MATRICES: Record<string, WeightMatrix> = {
  '信息问答': {
    completeness: 3,
    professionalism: 3,
    structure: 2,
    practicality: 1,
    naturalness: 1,
    interaction: 0,
  },
  '创作生成': {
    completeness: 1,
    professionalism: 1,
    structure: 2,
    practicality: 2,
    naturalness: 3,
    interaction: 1,
  },
  '工具类': {
    completeness: 2,
    professionalism: 1,
    structure: 1,
    practicality: 3,
    naturalness: 1,
    interaction: 0,
  },
  '推理分析': {
    completeness: 2,
    professionalism: 3,
    structure: 3,
    practicality: 2,
    naturalness: 1,
    interaction: 1,
  },
};

// ============================================================
// LLM Scorer (Phase 2 — production-ready)
// ============================================================

/** Supported LLM provider backends. */
export type LLMProvider = 'openai' | 'claude' | 'gemini' | 'deepseek' | 'custom';

/** Configuration for an LLM-based scorer. */
export interface LLMScorerConfig {
  /** Which LLM provider to use. */
  provider: LLMProvider;
  /** Model name (e.g. "gpt-4o", "claude-sonnet-5", "gemini-2.5-pro"). */
  model: string;
  /** API key. Use env var in production. */
  apiKey?: string;
  /** Temperature for scoring (0–1). Lower = more consistent. */
  temperature?: number;
  /** Maximum tokens for the response. */
  maxTokens?: number;
  /** Custom base URL for self-hosted / proxy endpoints. */
  baseUrl?: string;
}

/**
 * LLM Scorer interface.
 *
 * Implementations accept LLMScorerConfig and return a ScorerFn
 * compatible with the existing reviewAnswer().
 *
 * Usage:
 *   const scorer = new MyLLMScorer(config);
 *   const result = reviewAnswer(q, type, a, name, ctx, scorer.score);
 */
export interface ILLMScorer {
  /** Human-readable name for logging. */
  readonly name: string;
  /** The provider this scorer uses. */
  readonly provider: LLMProvider;
  /** Score a single answer. Same signature as ScorerFn. */
  score: (
    questionText: string,
    questionType: string,
    answerText: string,
    answererName: string,
    context?: ReviewContext,
  ) => Promise<ReviewResult> | ReviewResult;
}
