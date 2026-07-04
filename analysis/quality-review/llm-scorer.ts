// ============================================================
// Quality Review — LLM Scorer (Production)
// ============================================================
// Calls OpenAI-compatible API for dimension-based answer scoring.
// Falls back to RuleScorer when no API key is configured or
// when the API call fails.

import type {
  ReviewResult,
  ReviewContext,
  ILLMScorer,
  LLMScorerConfig,
  LLMProvider,
  DimensionId,
  DimensionScore,
} from './types';
import { DIMENSIONS } from './scorer';
import { WEIGHT_MATRICES } from './types';
import { reviewAnswer as ruleScore } from './scorer';

// -----------------------------------------------------------
// System Prompt (from docs/analysis_prompts.md)
// -----------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert evaluator for AI Chat product answer quality.

Evaluate the given answer on the following 6 dimensions. For each dimension:
1. Write a short comment in Chinese (20-80 characters) explaining the score.
2. Assign a score from 1 to 5 (integer only).
   - 1 = very poor, major issues
   - 3 = average, acceptable
   - 5 = excellent, near-perfect
3. If a dimension is marked "weight=0", return score=0 and comment="不适用".

Dimensions:
- completeness (Content Completeness): Does the answer fully cover all aspects of the question?
- professionalism (Professionalism): Is the terminology and reasoning rigorous and professional?
- structure (Structure & Clarity): Is the answer well-organized with clear sections?
- practicality (Practicality): Is the answer directly usable and actionable?
- naturalness (Naturalness): Is the language natural and fluent?
- interaction (Interaction): Does the answer invite further engagement?

Also provide:
- strengths: 1-3 things the answer does well (Chinese, each 5-15 chars)
- weaknesses: 1-3 things to improve (Chinese, each 5-15 chars)

Return ONLY valid JSON in this exact format:
{
  "answererName": "string",
  "dimensions": {
    "completeness":    { "score": 4, "comment": "..." },
    "professionalism": { "score": 4, "comment": "..." },
    "structure":       { "score": 3, "comment": "..." },
    "practicality":    { "score": 4, "comment": "..." },
    "naturalness":     { "score": 4, "comment": "..." },
    "interaction":     { "score": 0, "comment": "不适用" }
  },
  "strengths": ["..."],
  "weaknesses": ["..."],
  "shortSummary": "A one-sentence summary in Chinese"
}

Do NOT wrap the JSON in markdown code blocks. Output pure JSON only.`;

// -----------------------------------------------------------
// Prompt builder
// -----------------------------------------------------------

interface PromptInput {
  questionText: string;
  questionType: string;
  answerText: string;
  answererName: string;
  activeDimensions: string[];
  fcResult?: string;
}

function buildUserPrompt(input: PromptInput): string {
  const parts: string[] = [
    `## Question\n${input.questionText}`,
    `## Question Type\n${input.questionType}`,
    `## Answerer\n${input.answererName}`,
    `## Answer\n${input.answerText}`,
    `## Active Dimensions\n${input.activeDimensions.join(', ')}`,
  ];

  if (input.fcResult) {
    parts.push(`## Fact Check Result\n${input.fcResult}`);
  }

  parts.push('## Instructions\nEvaluate the answer and return JSON.');
  return parts.join('\n\n');
}

// -----------------------------------------------------------
// Response parser
// -----------------------------------------------------------

function parseResponse(
  json: Record<string, unknown>,
  answererName: string,
  questionType: string,
): ReviewResult {
  const weights = WEIGHT_MATRICES[questionType] ?? WEIGHT_MATRICES['信息问答'];
  const rawDims = (json.dimensions ?? {}) as Record<string, { score?: number; comment?: string }>;

  const dimensions: Record<DimensionId, DimensionScore> = {} as Record<DimensionId, DimensionScore>;
  let weightedSum = 0;
  let totalWeight = 0;

  for (const dim of DIMENSIONS) {
    const raw = rawDims[dim.id];
    const weight = weights[dim.id] ?? 1;

    if (weight === 0) {
      dimensions[dim.id] = { score: 0, comment: '不适用' };
      continue;
    }

    const score = Math.max(0, Math.min(5, Math.round(raw?.score ?? 3)));
    const comment = raw?.comment || '-';

    dimensions[dim.id] = { score, comment };
    weightedSum += score * weight;
    totalWeight += weight;
  }

  const totalScore = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 20) : 0;

  const strengths = (Array.isArray(json.strengths) ? json.strengths : []) as string[];
  const weaknesses = (Array.isArray(json.weaknesses) ? json.weaknesses : []) as string[];
  const shortSummary = (json.shortSummary as string) || `${answererName} 得分 ${totalScore}`;

  return {
    answererName: (json.answererName as string) || answererName,
    totalScore,
    dimensions,
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    shortSummary,
  };
}

// -----------------------------------------------------------
// LLM Scorer (real API call)
// -----------------------------------------------------------

const DEFAULT_BASE_URLS: Record<LLMProvider, string> = {
  openai: 'https://api.openai.com/v1',
  claude: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com/v1',
  custom: '',
};

export class LLMScorer implements ILLMScorer {
  readonly name: string;
  readonly provider: LLMProvider;
  private model: string;
  private apiKey: string;
  private temperature: number;
  private maxTokens: number;
  private baseUrl: string;

  constructor(config: LLMScorerConfig) {
    this.provider = config.provider;
    this.model = config.model;
    this.temperature = config.temperature ?? 0.3;
    this.maxTokens = config.maxTokens ?? 2048;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URLS[config.provider];
    this.name = `llm-${config.provider}-${config.model}`;

    // Resolve API key: explicit config → env var → empty
    this.apiKey = config.apiKey ?? '';
    if (!this.apiKey) {
      const envKeys: Record<string, string> = {
        openai: 'OPENAI_API_KEY',
        claude: 'ANTHROPIC_API_KEY',
        gemini: 'GEMINI_API_KEY',
      };
      this.apiKey = process.env[envKeys[config.provider] ?? ''] ?? '';
    }
  }

  /**
   * Score a single answer via LLM API.
   * Falls back to RuleScorer if no API key or on failure.
   */
  score(
    questionText: string,
    questionType: string,
    answerText: string,
    answererName: string,
    context?: ReviewContext,
  ): ReviewResult {
    // No API key → fall back to rule-based
    if (!this.apiKey) {
      return ruleScore(questionText, questionType, answerText, answererName, context);
    }

    // Fire and forget — if async, return rule score as initial,
    // but schedule the real call. For sync compatibility with ScorerFn,
    // we return rule score and log that LLM would be called.
    // The caller can use the async version instead.
    console.log(`[LLMScorer] API key configured — would call ${this.provider} (${this.model})`);
    console.log(`[LLMScorer] Using rule-based score (call scoreAsync() for real LLM)`);

    return ruleScore(questionText, questionType, answerText, answererName, context);
  }

  /**
   * Async version — makes the real LLM API call.
   * Falls back to RuleScorer on any network or API error.
   */
  async scoreAsync(
    questionText: string,
    questionType: string,
    answerText: string,
    answererName: string,
    context?: ReviewContext,
  ): Promise<ReviewResult> {
    // No API key or empty answer → fall back
    if (!this.apiKey || !answerText.trim()) {
      return ruleScore(questionText, questionType, answerText, answererName, context);
    }

    const weights = WEIGHT_MATRICES[questionType] ?? WEIGHT_MATRICES['信息问答'];
    const activeDimensions = DIMENSIONS
      .filter((d) => (weights[d.id] ?? 1) > 0)
      .map((d) => d.id);

    const prompt = buildUserPrompt({
      questionText,
      questionType,
      answerText,
      answererName,
      activeDimensions,
      fcResult: context?.factCheckFailed ? 'Fact Check failed — accuracy should be penalized' : undefined,
    });

    try {
      const endpoint = `${this.baseUrl}/chat/completions`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          temperature: this.temperature,
          max_tokens: this.maxTokens,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 200)}`);
      }

      const data = await response.json() as Record<string, unknown>;
      const content = (
        (data.choices as Array<{ message?: { content?: string } }>)?.[0]?.message?.content ?? ''
      );

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(content);
      } catch {
        // If the response is wrapped in ```json ... ```, strip it
        const cleaned = content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
        parsed = JSON.parse(cleaned);
      }

      return parseResponse(parsed, answererName, questionType);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[LLMScorer] API call failed: ${message}`);
      console.warn(`[LLMScorer] Falling back to RuleScorer`);
      return ruleScore(questionText, questionType, answerText, answererName, context);
    }
  }
}

// -----------------------------------------------------------
// Factory
// -----------------------------------------------------------

export function createLLMScorer(config: LLMScorerConfig): LLMScorer {
  return new LLMScorer(config);
}

// -----------------------------------------------------------
// Auto-configure from environment
// -----------------------------------------------------------

/**
 * Auto-detect available LLM from environment variables.
 * Returns null if no API key is configured.
 *
 * Priority: OPENAI_API_KEY > ANTHROPIC_API_KEY > GEMINI_API_KEY
 */
/**
 * Auto-detect available LLM from environment variables.
 * Returns null if no API key is configured.
 *
 * Supports:
 *   - OPENAI_API_KEY / LLM_API_KEY + LLM_BASE_URL → any OpenAI-compatible
 *   - ANTHROPIC_API_KEY → Claude
 *   - GEMINI_API_KEY → Gemini
 */
export function autoCreateLLMScorer(): LLMScorer | null {
  const key = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  if (key) {
    const baseUrl = process.env.LLM_BASE_URL || '';
    const provider = baseUrl.includes('deepseek') ? 'deepseek' as LLMProvider
      : baseUrl.includes('anthropic') ? 'claude' as LLMProvider
      : baseUrl.includes('openai') ? 'openai' as LLMProvider
      : 'custom' as LLMProvider;
    return new LLMScorer({
      provider,
      model: process.env.LLM_MODEL || 'deepseek-chat',
      apiKey: key,
      baseUrl: baseUrl || undefined,
    });
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return new LLMScorer({
      provider: 'claude',
      model: process.env.LLM_MODEL || 'claude-sonnet-5',
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  if (process.env.GEMINI_API_KEY) {
    return new LLMScorer({
      provider: 'gemini',
      model: process.env.LLM_MODEL || 'gemini-2.5-pro',
      apiKey: process.env.GEMINI_API_KEY,
    });
  }
  return null;
}
