// ============================================================
// Quality Review — Scoring Engine
// ============================================================
// Heuristic-based scorer (placeholder until LLM integration).
// Interface is designed so an LLM scorer can be dropped in
// without changing any calling code.
//
// To swap in LLM: implement ScorerFn with the same signature
// and pass it to reviewAnswer().

import type {
  DimensionId,
  DimensionScore,
  ReviewResult,
  ReviewContext,
  WeightMatrix,
} from './types';
import { WEIGHT_MATRICES } from './types';

// -----------------------------------------------------------
// Scorer interface (LLM-ready)
// -----------------------------------------------------------

export type ScorerFn = (
  questionText: string,
  questionType: string,
  answerText: string,
  answererName: string,
  context?: ReviewContext,
) => ReviewResult;

// -----------------------------------------------------------
// Dimension definitions (for LLM prompt / heuristic reference)
// -----------------------------------------------------------

interface DimensionDef {
  id: DimensionId;
  label: string;
  description: string;
}

export const DIMENSIONS: DimensionDef[] = [
  {
    id: 'completeness',
    label: 'Content Completeness',
    description: '是否全面覆盖了问题的所有方面，有无遗漏关键信息点',
  },
  {
    id: 'professionalism',
    label: 'Professionalism',
    description: '术语使用是否准确，论证是否严谨，展现的专业知识深度',
  },
  {
    id: 'structure',
    label: 'Structure & Clarity',
    description: '回答是否有清晰的分段、标题、逻辑层次，是否易于阅读',
  },
  {
    id: 'practicality',
    label: 'Practicality',
    description: '回答是否可直接使用，建议是否具体可执行',
  },
  {
    id: 'naturalness',
    label: 'Naturalness',
    description: '语言表达是否流畅自然，有无翻译腔或生硬感',
  },
  {
    id: 'interaction',
    label: 'Interaction',
    description: '回答是否有引导性、互动感，是否鼓励用户进一步交流',
  },
];

// -----------------------------------------------------------
// Heuristic scorers (per dimension)
// -----------------------------------------------------------

function scoreCompleteness(question: string, answer: string): DimensionScore {
  const len = answer.length;
  const hasMultiplePoints = (answer.match(/[;；\n•\-—]/g) || []).length >= 2;
  const hasConclusion = /总之|综上|总结|in summary|overall/i.test(answer);

  let score: number;
  if (len === 0) score = 1;
  else if (len < 80) score = 2;
  else if (len < 200) score = 3;
  else if (len >= 200 && hasMultiplePoints && hasConclusion) score = 5;
  else if (len >= 200 && (hasMultiplePoints || hasConclusion)) score = 4;
  else score = 3;

  return { score, comment: buildComment(score, '内容覆盖') };
}

function scoreProfessionalism(question: string, answer: string): DimensionScore {
  const len = answer.length;
  const technicalTerms = (answer.match(/[A-Z][a-z]+ [A-Z]|algorithm|model|framework|architecture|API|SDK|protocol|methodology|optimization|scalable|latency|throughput|神经网络|算法|模型|架构|协议|方法论|优化/g) || []).length;
  const hasCitation = /according to|研究表明|based on|根据|引用|参考/.test(answer);

  let score: number;
  if (len === 0) score = 1;
  else if (len < 50) score = 2;
  else if (technicalTerms >= 3 || hasCitation) score = 5;
  else if (technicalTerms >= 1 || (len > 200 && hasCitation)) score = 4;
  else score = 3;

  return { score, comment: buildComment(score, '专业度') };
}

function scoreStructure(question: string, answer: string): DimensionScore {
  const len = answer.length;
  const hasHeadings = /#|##|###|【.*】|^\d+[\.\、]|^[一二三四五六七八九十]+[、.]|^\*\*.*\*\*$/m.test(answer);
  const hasList = /^[\-\*•]\s|^\d+[\.\)]\s/m.test(answer);
  const paragraphs = answer.split(/\n\n+/).filter((p) => p.trim().length > 30).length;

  let score: number;
  if (len === 0) score = 1;
  else if (len < 60) score = 2;
  else if (hasHeadings && hasList) score = 5;
  else if (hasHeadings || (hasList && paragraphs >= 2)) score = 4;
  else if (paragraphs >= 3) score = 4;
  else score = 3;

  return { score, comment: buildComment(score, '结构') };
}

function scorePracticality(question: string, answer: string): DimensionScore {
  const len = answer.length;
  const isToolQuestion = /翻译|总结|计算|convert|translate|summarize|write|写|生成|列出/.test(question);
  const isCreative = /写|创作|generate|create|设计|draw|画/.test(question);
  const hasActionable = /步骤|step|首先|然后|最后|first|then|finally|你可以|you can|建议|recommend/.test(answer);
  const hasTemplate = /模板|template|示例|example|格式|format/.test(answer);

  let score: number;
  if (len === 0) score = 1;
  else if (!isToolQuestion && !isCreative && len < 60) score = 2;
  else if (isToolQuestion && hasActionable && (hasTemplate || len > 200)) score = 5;
  else if (hasActionable && hasTemplate) score = 5;
  else if (hasActionable) score = 4;
  else if (len > 150) score = 3;
  else score = 2;

  return { score, comment: buildComment(score, '实用性') };
}

function scoreNaturalness(question: string, answer: string): DimensionScore {
  const len = answer.length;
  const hasMachinePatterns = /请注意|请务必|根据我的理解|作为一个人工智能|as an AI|I must inform|I cannot|请知悉/.test(answer);
  const hasConversational = /你觉得|你可以|we can|let's|let us|think about|consider|吧|呢|哦|哈/.test(answer);
  const sentenceVariety = (answer.match(/[。.!！?？\n]/g) || []).length;

  let score: number;
  if (len === 0) score = 1;
  else if (hasMachinePatterns && len < 100) score = 2;
  else if (hasMachinePatterns) score = 3;
  else if (hasConversational && sentenceVariety >= 4) score = 5;
  else if (hasConversational || sentenceVariety >= 4) score = 4;
  else if (len > 100) score = 3;
  else score = 2;

  return { score, comment: buildComment(score, '语言自然度') };
}

function scoreInteraction(question: string, answer: string): DimensionScore {
  const len = answer.length;
  const hasQuestion = /[？?]$/m.test(answer.trim());
  const hasInvitation = /有什么|需要|可以继续|随时|let me know|feel free|happy to|更多|further/.test(answer);
  const hasFollowUp = /如果你|if you|还需要|would you like|want me to|shall I/.test(answer);

  let score: number;
  if (len === 0) score = 1;
  else if (!hasQuestion && !hasInvitation && !hasFollowUp) score = 2;
  else if (hasInvitation && hasFollowUp) score = 5;
  else if (hasInvitation || hasFollowUp || hasQuestion) score = 4;
  else score = 3;

  return { score, comment: buildComment(score, '互动引导') };
}

type DimensionScorerFn = (question: string, answer: string) => DimensionScore;

const SCORERS: Record<DimensionId, DimensionScorerFn> = {
  completeness: scoreCompleteness,
  professionalism: scoreProfessionalism,
  structure: scoreStructure,
  practicality: scorePracticality,
  naturalness: scoreNaturalness,
  interaction: scoreInteraction,
};

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

function buildComment(score: number, aspect: string): string {
  switch (score) {
    case 5: return `${aspect}表现优秀`;
    case 4: return `${aspect}表现良好`;
    case 3: return `${aspect}表现一般`;
    case 2: return `${aspect}存在不足`;
    case 1: return `${aspect}严重不足`;
    default: return `${aspect}不适用`;
  }
}

function computeTotalScore(
  dimensions: Record<DimensionId, DimensionScore>,
  weights: WeightMatrix,
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, dim] of Object.entries(dimensions) as [DimensionId, DimensionScore][]) {
    const weight = weights[key] ?? 1;
    if (weight === 0) continue;
    weightedSum += dim.score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 20); // scale to 0–100
}

function extractStrengths(
  dimensions: Record<DimensionId, DimensionScore>,
): string[] {
  return Object.entries(dimensions)
    .filter(([, d]) => d.score >= 4)
    .map(([key]) => DIMENSIONS.find((dd) => dd.id === key)?.label ?? key);
}

function extractWeaknesses(
  dimensions: Record<DimensionId, DimensionScore>,
): string[] {
  return Object.entries(dimensions)
    .filter(([, d]) => d.score <= 2)
    .map(([key]) => DIMENSIONS.find((dd) => dd.id === key)?.label ?? key);
}

function buildSummary(
  answererName: string,
  totalScore: number,
  strengths: string[],
  weaknesses: string[],
): string {
  const level =
    totalScore >= 85 ? '优秀' : totalScore >= 65 ? '良好' : totalScore >= 45 ? '一般' : '较差';

  const parts: string[] = [`${answererName} 的回答整体${level}（${totalScore}分）`];

  if (strengths.length > 0) {
    parts.push(`优势：${strengths.slice(0, 2).join('、')}`);
  }
  if (weaknesses.length > 0) {
    parts.push(`可改进：${weaknesses.slice(0, 2).join('、')}`);
  }

  return parts.join('。') + '。';
}

// -----------------------------------------------------------
// Public: reviewAnswer
// -----------------------------------------------------------

/**
 * Score a single answer against a question.
 *
 * Uses heuristic scoring by default. To switch to LLM-based scoring,
 * pass a different `scorer` function.
 */
export function reviewAnswer(
  questionText: string,
  questionType: string,
  answerText: string,
  answererName: string,
  context?: ReviewContext,
  scorer?: ScorerFn,
): ReviewResult {
  // If a custom scorer is provided (LLM), delegate to it.
  if (scorer) {
    return scorer(questionText, questionType, answerText, answererName, context);
  }

  // Heuristic scoring path
  const weights = WEIGHT_MATRICES[questionType] ?? WEIGHT_MATRICES['信息问答'];

  // Apply Fact Check penalty if available (future integration)
  const overrideAccuracy = context?.factCheckFailed === true;

  const dimensions: Record<DimensionId, DimensionScore> = {} as Record<DimensionId, DimensionScore>;

  for (const dimId of Object.keys(weights) as DimensionId[]) {
    if (weights[dimId] === 0) {
      dimensions[dimId] = { score: 0, comment: '不适用' };
      continue;
    }

    let dimScore = SCORERS[dimId](questionText, answerText);

    // If Fact Check failed, accuracy-related dimensions are capped
    if (overrideAccuracy && (dimId === 'professionalism' || dimId === 'completeness')) {
      dimScore = { ...dimScore, score: Math.min(dimScore.score, 2) };
    }

    dimensions[dimId] = dimScore;
  }

  const totalScore = computeTotalScore(dimensions, weights);
  const strengths = extractStrengths(dimensions);
  const weaknesses = extractWeaknesses(dimensions);
  const shortSummary = buildSummary(answererName, totalScore, strengths, weaknesses);

  return {
    answererName,
    totalScore,
    dimensions,
    strengths,
    weaknesses,
    shortSummary,
  };
}

// -----------------------------------------------------------
// Scorer Factory
// -----------------------------------------------------------

export type ScorerMode = 'rule' | 'llm';

export interface ScorerFactoryOptions {
  /** Which scorer to use. 'rule' = heuristic (default), 'llm' = LLM. */
  mode: ScorerMode;
  /** LLM scorer instance. Required when mode='llm'. */
  llmScorer?: import('./types').ILLMScorer;
}

/**
 * Create a ScorerFn based on the configured mode.
 *
 * Usage:
 *   // Rule-based (default)
 *   const scorer = createScorer({ mode: 'rule' });
 *
 *   // LLM-based
 *   const llm = createLLMScorer({ provider: 'openai', model: 'gpt-4o' });
 *   const scorer = createScorer({ mode: 'llm', llmScorer: llm });
 *
 *   const result = reviewAnswer(q, type, a, name, ctx, scorer);
 */
export function createScorer(options: ScorerFactoryOptions): ScorerFn {
  if (options.mode === 'llm' && options.llmScorer) {
    const llm = options.llmScorer;
    return (questionText, questionType, answerText, answererName, context) =>
      llm.score(questionText, questionType, answerText, answererName, context) as ReviewResult;
  }

  // Default: rule-based
  return reviewAnswer as ScorerFn;
}
