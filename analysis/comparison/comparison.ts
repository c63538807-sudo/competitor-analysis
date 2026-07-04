// ============================================================
// Comparison Engine (Sprint 4)
// ============================================================
// Pure rule engine — no LLM.
// Reads QuestionResult.reviews → fills QuestionResult.comparison.
//
// Produces objective comparison data. Does NOT declare a winner.

import type { ReviewResult, DimensionId } from '../quality-review/types';
import { DIMENSIONS } from '../quality-review/scorer';
import type { AnalysisResult, ComparisonResult } from '../models/analysis-result';

// -----------------------------------------------------------
// Ranking
// -----------------------------------------------------------

interface RankEntry {
  answererName: string;
  rank: number;
  totalScore: number;
}

function buildRanking(reviews: ReviewResult[]): RankEntry[] {
  const sorted = [...reviews].sort((a, b) => b.totalScore - a.totalScore);

  return sorted.map((r, i) => ({
    answererName: r.answererName,
    rank: i + 1,
    totalScore: r.totalScore,
  }));
}

// -----------------------------------------------------------
// Score Table
// -----------------------------------------------------------

interface ScoreTableEntry {
  answererName: string;
  totalScore: number;
  dimensions: Record<string, number>;
}

function buildScoreTable(reviews: ReviewResult[]): ScoreTableEntry[] {
  return reviews.map((r) => ({
    answererName: r.answererName,
    totalScore: r.totalScore,
    dimensions: Object.fromEntries(
      (Object.entries(r.dimensions) as [DimensionId, { score: number }][]).map(
        ([key, val]) => [key, val.score],
      ),
    ),
  }));
}

// -----------------------------------------------------------
// Dimension Comparison
// -----------------------------------------------------------

interface DimComparison {
  dimension: string;
  label: string;
  scores: Record<string, number>;
  leader: string;
}

function buildDimensionComparison(reviews: ReviewResult[]): DimComparison[] {
  const dimIds: DimensionId[] = [
    'completeness', 'professionalism', 'structure',
    'practicality', 'naturalness', 'interaction',
  ];

  return dimIds.map((dimId) => {
    const def = DIMENSIONS.find((d) => d.id === dimId);
    const scores: Record<string, number> = {};

    let bestName = '';
    let bestScore = -1;

    for (const r of reviews) {
      const dimScore = r.dimensions[dimId]?.score ?? 0;
      scores[r.answererName] = dimScore;
      if (dimScore > bestScore) {
        bestScore = dimScore;
        bestName = r.answererName;
      }
    }

    return {
      dimension: dimId,
      label: def?.label ?? dimId,
      scores,
      leader: bestScore > 0 ? bestName : '—',
    };
  });
}

// -----------------------------------------------------------
// Key Differences (gap ≥ 2 between top two scorers per dimension)
// -----------------------------------------------------------

interface KeyDiff {
  dimension: string;
  label: string;
  leader: string;
  gap: number;
  description: string;
}

const GAP_THRESHOLD = 2;

function buildKeyDifferences(
  reviews: ReviewResult[],
  dimComparison: DimComparison[],
): KeyDiff[] {
  const diffs: KeyDiff[] = [];

  for (const dc of dimComparison) {
    const entries = Object.entries(dc.scores)
      .filter(([, s]) => s > 0) // exclude zero-weight dimensions
      .sort((a, b) => b[1] - a[1]);

    if (entries.length < 2) continue;

    const [first, second] = entries;
    const gap = first[1] - second[1];

    if (gap >= GAP_THRESHOLD) {
      diffs.push({
        dimension: dc.dimension,
        label: dc.label,
        leader: first[0],
        gap,
        description:
          gap >= 3
            ? `${first[0]} 在${dc.label}上明显领先（差距 ${gap} 分）`
            : `${first[0]} 在${dc.label}上略有优势（差距 ${gap} 分）`,
      });
    }
  }

  return diffs;
}

// -----------------------------------------------------------
// Analysis Summary (objective, no winner declaration)
// -----------------------------------------------------------

function buildSummary(
  ranking: RankEntry[],
  dimComparison: DimComparison[],
  keyDifferences: KeyDiff[],
): string {
  if (ranking.length === 0) return '';

  const parts: string[] = [];

  // Score ranking
  const top = ranking[0];
  parts.push(`综合得分最高的是 ${top.answererName}（${top.totalScore} 分）`);

  // Dimension leaders
  const leaders = new Map<string, number>();
  for (const dc of dimComparison) {
    if (dc.leader !== '—') {
      leaders.set(dc.leader, (leaders.get(dc.leader) ?? 0) + 1);
    }
  }
  const leaderEntries = Array.from(leaders.entries()).sort((a, b) => b[1] - a[1]);
  const dimSummary = leaderEntries
    .map(([name, count]) => `${name} 在 ${count} 个维度上得分最高`)
    .join('；');
  if (dimSummary) parts.push(dimSummary);

  // Key gaps
  if (keyDifferences.length > 0) {
    const gapSummary = keyDifferences
      .map((kd) => kd.description)
      .join('。');
    parts.push(gapSummary);
  }

  return parts.join('。') + '。';
}

// -----------------------------------------------------------
// Public API
// -----------------------------------------------------------

/**
 * Compare all answerers for a single question.
 * Reads reviews, produces an objective ComparisonResult.
 */
export function compareQuestion(reviews: ReviewResult[]): ComparisonResult {
  const ranking = buildRanking(reviews);
  const scoreTable = buildScoreTable(reviews);
  const dimensionComparison = buildDimensionComparison(reviews);
  const keyDifferences = buildKeyDifferences(reviews, dimensionComparison);
  const analysisSummary = buildSummary(ranking, dimensionComparison, keyDifferences);

  return {
    ranking,
    scoreTable,
    dimensionComparison,
    keyDifferences,
    analysisSummary,
  };
}

/**
 * Compare all questions in an AnalysisResult.
 * Fills questions[].comparison in place.
 * Returns the same result object (mutated).
 */
export function compareSession(result: AnalysisResult): AnalysisResult {
  for (const qr of result.questions) {
    if (qr.reviews.length === 0) {
      qr.comparison = null;
      continue;
    }
    qr.comparison = compareQuestion(qr.reviews);
  }
  return result;
}
