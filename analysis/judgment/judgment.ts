// ============================================================
// Judgment Engine (Sprint 5)
// ============================================================
// Pure rule engine — no LLM.
// Reads QuestionResult.comparison → fills QuestionResult.judgment.

import type { AnalysisResult, JudgmentResult } from '../models/analysis-result';
import type { ComparisonResult } from '../models/analysis-result';

// -----------------------------------------------------------
// Configurable thresholds
// -----------------------------------------------------------

export interface JudgmentThresholds {
  /** Gap ≥ this → AIC Better (High confidence). */
  aicBetterHigh: number;
  /** Gap ≥ this → AIC Better (Medium confidence). */
  aicBetterMedium: number;
  /** |Gap| ≤ this → Tie. */
  tieMax: number;
  /** Gap ≤ −this → Competitor Better (Medium confidence). */
  competitorBetterMedium: number;
  /** Gap ≤ −this → Competitor Better (High confidence). */
  competitorBetterHigh: number;
}

export const DEFAULT_THRESHOLDS: JudgmentThresholds = {
  aicBetterHigh: 8,
  aicBetterMedium: 4,
  tieMax: 3,
  competitorBetterMedium: -7,
  competitorBetterHigh: -8,
};

// -----------------------------------------------------------
// Confidence within Tie range
// -----------------------------------------------------------

function tieConfidence(gap: number): 'High' | 'Medium' | 'Low' {
  const abs = Math.abs(gap);
  if (abs === 0) return 'High';
  if (abs <= 2) return 'Medium';
  return 'Low';
}

// -----------------------------------------------------------
// Reason generation
// -----------------------------------------------------------

function buildReasons(
  result: 'AIC Better' | 'Competitor Better' | 'Tie',
  winner: string,
  scoreGap: number,
  comparison: ComparisonResult,
): string[] {
  const reasons: string[] = [];

  const top = comparison.ranking[0];
  reasons.push(`综合得分：${top.answererName} ${top.totalScore} 分`);

  // Add who leads in most dimensions
  const leaderCounts = new Map<string, number>();
  for (const dc of comparison.dimensionComparison) {
    if (dc.leader !== '—') {
      leaderCounts.set(dc.leader, (leaderCounts.get(dc.leader) ?? 0) + 1);
    }
  }
  const sorted = Array.from(leaderCounts.entries()).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0) {
    reasons.push(`维度领先：${sorted[0][0]} 在 ${sorted[0][1]} 个维度上得分最高`);
  }

  // Key gaps
  if (comparison.keyDifferences.length > 0) {
    const kd = comparison.keyDifferences[0];
    reasons.push(kd.description);
  }

  // Score gap
  const gapAbs = Math.abs(scoreGap);
  if (result === 'Tie') {
    reasons.push(`分差仅 ${gapAbs} 分，无明显差异`);
  } else if (result === 'AIC Better') {
    reasons.push(`AIC 领先 ${gapAbs} 分`);
  } else {
    reasons.push(`${winner} 领先 ${gapAbs} 分`);
  }

  return reasons;
}

// -----------------------------------------------------------
// Public: judgeQuestion
// -----------------------------------------------------------

/**
 * Render a judgment for a single question based on its comparison data.
 *
 * Rules (DEFAULT_THRESHOLDS):
 *   gap ≥ 8  → AIC Better  (High)
 *   gap 4–7  → AIC Better  (Medium)
 *   gap -3~3 → Tie
 *   gap -7~-4 → Competitor Better (Medium)
 *   gap ≤ -8  → Competitor Better (High)
 */
export function judgeQuestion(
  comparison: ComparisonResult,
  thresholds: JudgmentThresholds = DEFAULT_THRESHOLDS,
): JudgmentResult {
  const { ranking } = comparison;

  // No data → default to Tie, Low
  if (ranking.length === 0) {
    return {
      winner: '—',
      result: 'Tie',
      confidence: 'Low',
      scoreGap: 0,
      reasons: ['无可用评分数据'],
    };
  }

  // Find AIC and best competitor
  const aic = ranking.find((r) => r.answererName === 'AIC');
  const bestCompetitor = ranking.find((r) => r.answererName !== 'AIC');

  // If no AIC in ranking (shouldn't happen), treat as Tie
  if (!aic) {
    return {
      winner: '—',
      result: 'Tie',
      confidence: 'Low',
      scoreGap: 0,
      reasons: ['评分数据中未找到 AIC'],
    };
  }

  // If no other competitors, AIC wins by default
  if (!bestCompetitor) {
    return {
      winner: 'AIC',
      result: 'AIC Better',
      confidence: 'High',
      scoreGap: aic.totalScore,
      reasons: ['AIC 是唯一的回答者'],
    };
  }

  const scoreGap = aic.totalScore - bestCompetitor.totalScore;

  // Apply threshold rules
  let result: 'AIC Better' | 'Competitor Better' | 'Tie';
  let winner: string;
  let confidence: 'High' | 'Medium' | 'Low';

  if (scoreGap >= thresholds.aicBetterHigh) {
    result = 'AIC Better';
    winner = 'AIC';
    confidence = 'High';
  } else if (scoreGap >= thresholds.aicBetterMedium) {
    result = 'AIC Better';
    winner = 'AIC';
    confidence = 'Medium';
  } else if (scoreGap >= -thresholds.tieMax) {
    result = 'Tie';
    winner = '—';
    confidence = tieConfidence(scoreGap);
  } else if (scoreGap >= thresholds.competitorBetterMedium) {
    result = 'Competitor Better';
    winner = bestCompetitor.answererName;
    confidence = 'Medium';
  } else {
    result = 'Competitor Better';
    winner = bestCompetitor.answererName;
    confidence = 'High';
  }

  const reasons = buildReasons(result, winner, scoreGap, comparison);

  return { winner, result, confidence, scoreGap, reasons };
}

// -----------------------------------------------------------
// Public: judgeSession
// -----------------------------------------------------------

/**
 * Judge every question in an AnalysisResult.
 * Fills questions[].judgment in place.
 * Returns the same result object (mutated).
 */
export function judgeSession(
  result: AnalysisResult,
  thresholds: JudgmentThresholds = DEFAULT_THRESHOLDS,
): AnalysisResult {
  for (const qr of result.questions) {
    if (!qr.comparison) {
      qr.judgment = null;
      continue;
    }
    qr.judgment = judgeQuestion(qr.comparison, thresholds);
  }
  return result;
}
