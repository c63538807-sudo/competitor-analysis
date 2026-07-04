// ============================================================
// Suggestion Engine (Sprint 6)
// ============================================================
// Rule engine — generates improvement suggestions based on
// reviews, comparison, and judgment data.
//
// Reads  QuestionResult.reviews / .comparison / .judgment
// Fills  QuestionResult.suggestion

import type { AnalysisResult, SuggestionResult } from '../models/analysis-result';
import type { JudgmentResult } from '../models/analysis-result';
import type { ReviewResult } from '../quality-review/types';

// -----------------------------------------------------------
// Dimension → improvement mapping (configurable)
// -----------------------------------------------------------

interface DimensionAdvice {
  area: string;
  action: string;
}

export const DIMENSION_ADVICE: Record<string, DimensionAdvice> = {
  completeness: {
    area: 'Content Completeness',
    action: '补充关键信息点，确保全面覆盖用户问题的所有方面',
  },
  professionalism: {
    area: 'Professionalism & Accuracy',
    action: '提升术语准确性和论证严谨度，增强专业深度',
  },
  structure: {
    area: 'Structure & Clarity',
    action: '采用标题分段和要点摘要，优化信息层次和可读性',
  },
  practicality: {
    area: 'Practicality & Usability',
    action: '增加可执行的具体步骤，输出可直接使用的格式',
  },
  naturalness: {
    area: 'Language Naturalness',
    action: '优化语言表达的自然度和流畅性，减少生硬感',
  },
  interaction: {
    area: 'Interaction & Engagement',
    action: '增加追问、反馈引导和互动元素，鼓励进一步交流',
  },
};

// -----------------------------------------------------------
// Detect low-score dimensions from AIC's review
// -----------------------------------------------------------

function findLowDimensions(aicReview?: ReviewResult): string[] {
  if (!aicReview) return [];

  const lows: string[] = [];
  for (const [key, dim] of Object.entries(aicReview.dimensions)) {
    if (dim.score > 0 && dim.score <= 2) {
      lows.push(key);
    }
  }
  return lows;
}

// -----------------------------------------------------------
// Detect dimensions where competitor leads (from comparison)
// -----------------------------------------------------------

function findTrailingDimensions(
  aicReview?: ReviewResult,
): string[] {
  if (!aicReview) return [];

  const trailing: string[] = [];
  for (const [key, dim] of Object.entries(aicReview.dimensions)) {
    if (dim.score <= 3) {
      trailing.push(key);
    }
  }
  return trailing;
}

// -----------------------------------------------------------
// Priority from judgment
// -----------------------------------------------------------

function determinePriority(judgment: JudgmentResult): 'High' | 'Medium' | 'Low' {
  if (judgment.result === 'Competitor Better') {
    return judgment.confidence === 'High' ? 'High' : 'Medium';
  }
  // Tie
  return 'Low';
}

// -----------------------------------------------------------
// Public: suggestQuestion
// -----------------------------------------------------------

/**
 * Generate improvement suggestions for a single question.
 *
 * Rules:
 *  - judgment = "AIC Better" → required=false, no suggestion
 *  - judgment = "Tie" or "Competitor Better" → analyse low dimensions
 */
export function suggestQuestion(
  reviews: ReviewResult[],
  judgment: JudgmentResult | null,
): SuggestionResult {
  // No judgment → cannot decide
  if (!judgment) {
    return {
      required: false,
      priority: 'Low',
      improvementAreas: [],
      actionItems: [],
      summary: 'No judgment data available.',
    };
  }

  // AIC Better → no suggestion needed
  if (judgment.result === 'AIC Better') {
    return {
      required: false,
      priority: 'Low',
      improvementAreas: [],
      actionItems: [],
      summary: 'No suggestion required.',
    };
  }

  // Find AIC's review
  const aicReview = reviews.find((r) => r.answererName === 'AIC');

  // Find low dimensions from AIC
  const lowDims = findLowDimensions(aicReview);

  // Also find trailing dimensions (score ≤ 3)
  const trailingDims = findTrailingDimensions(aicReview);

  // Merge: prefer lowDims, supplement with trailingDims
  const allDims = [...new Set([...lowDims, ...trailingDims])];

  // Generate improvement areas and action items
  const improvementAreas: string[] = [];
  const actionItems: string[] = [];

  for (const dim of allDims) {
    const advice = DIMENSION_ADVICE[dim];
    if (advice) {
      if (!improvementAreas.includes(advice.area)) {
        improvementAreas.push(advice.area);
      }
      actionItems.push(advice.action);
    }
  }

  // If no specific dims found, provide generic advice
  if (improvementAreas.length === 0) {
    improvementAreas.push('Overall Quality');
    actionItems.push('全面审视回答质量，与竞品对标各维度表现');
  }

  const priority = determinePriority(judgment);

  // Build summary
  const verdict =
    judgment.result === 'Competitor Better'
      ? `竞品 ${judgment.winner} 表现更好（分差 ${Math.abs(judgment.scoreGap)} 分）`
      : '与竞品持平';

  const summary =
    `${verdict}。建议优先改进：${improvementAreas.slice(0, 2).join('、')}。`;

  return {
    required: true,
    priority,
    improvementAreas: improvementAreas.slice(0, 3),
    actionItems: actionItems.slice(0, 3),
    summary,
  };
}

// -----------------------------------------------------------
// Public: suggestSession
// -----------------------------------------------------------

/**
 * Generate suggestions for every question in an AnalysisResult.
 * Fills questions[].suggestion in place.
 */
export function suggestSession(result: AnalysisResult): AnalysisResult {
  for (const qr of result.questions) {
    qr.suggestion = suggestQuestion(qr.reviews, qr.judgment);
  }
  return result;
}
