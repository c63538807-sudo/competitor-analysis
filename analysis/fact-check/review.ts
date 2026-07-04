// ============================================================
// Fact Check — Review Functions (Sprint 3: checker wired)
// ============================================================
// Public API: factCheckQuestion / factCheckSession.
// Extracts claims → verifies via provider → builds full result.

import type { AnalysisResult } from '../models/analysis-result';
import type { FactCheckResult, Claim } from './types';
import { extractClaims } from './extractor';
import { verifyClaims } from './checker';

// -----------------------------------------------------------
// Trigger logic
// -----------------------------------------------------------

export function determineFCTrigger(
  questionType: string,
  answerText: string,
): 'mandatory' | 'partial' | 'skip' {
  if (!answerText || answerText.trim().length === 0) return 'skip';

  switch (questionType) {
    case '信息问答': return 'mandatory';
    case '创作生成': return 'skip';
    case '工具类': return 'partial';
    case '推理分析': return 'partial';
    default: return 'skip';
  }
}

// -----------------------------------------------------------
// Result builder
// -----------------------------------------------------------

function computeOverallResult(claims: Claim[]): FactCheckResult['result'] {
  if (claims.length === 0) return '不适用';

  const verified = claims.filter((c) => c.status === 'verified').length;
  const refuted = claims.filter((c) => c.status === 'refuted').length;
  const total = claims.length;

  if (refuted > 0) return '未通过';
  if (verified === total) return '通过';
  if (verified >= total / 2) return '部分通过';
  return '无法验证';
}

function computeConfidence(claims: Claim[]): 'high' | 'medium' | 'low' {
  if (claims.length === 0) return 'low';
  const confidences = claims.map((c) => c.confidence);
  const highCount = confidences.filter((c) => c === 'high').length;
  if (highCount >= claims.length * 0.5) return 'high';
  if (highCount > 0) return 'medium';
  return 'low';
}

function buildSummary(claims: Claim[], required: string): string {
  if (claims.length === 0) {
    return required === 'skip' ? '此问题类型无需事实校验。' : '未提取到可验证的事实主张。';
  }

  const verified = claims.filter((c) => c.status === 'verified').length;
  const refuted = claims.filter((c) => c.status === 'refuted').length;
  const unverifiable = claims.filter((c) => c.status === 'unverifiable').length;

  const parts: string[] = [`共提取 ${claims.length} 条事实主张`];
  if (verified > 0) parts.push(`${verified} 条通过验证`);
  if (refuted > 0) parts.push(`${refuted} 条未通过`);
  if (unverifiable > 0) parts.push(`${unverifiable} 条无法验证`);

  return parts.join('，') + '。';
}

// -----------------------------------------------------------
// factCheckQuestion (async — calls provider)
// -----------------------------------------------------------

export async function factCheckQuestion(
  questionText: string,
  questionType: string,
  aicAnswer: string,
  competitorAnswers: { name: string; answer: string }[],
): Promise<FactCheckResult> {
  const allAnswers = [aicAnswer, ...competitorAnswers.map((c) => c.answer)];
  const combined = allAnswers.join(' ');
  const required = determineFCTrigger(questionType, combined);

  if (required === 'skip') {
    return {
      required: 'skip',
      result: '不适用',
      confidence: 'low',
      claims: [],
      summary: '此问题类型无需事实校验。',
      checkedAt: null,
    };
  }

  // Extract claims from all answerers
  const claims: Claim[] = [];

  const aicClaims = extractClaims(questionText, questionType, aicAnswer, 'AIC');
  claims.push(...aicClaims);

  for (const comp of competitorAnswers) {
    const compClaims = extractClaims(questionText, questionType, comp.answer, comp.name);
    claims.push(...compClaims);
  }

  // Assign IDs
  const indexed = claims.map((c, i) => ({ ...c, id: c.id || `claim-${i + 1}` }));

  // Verify via provider
  const verified = await verifyClaims(indexed);

  // Build result
  return {
    required,
    result: computeOverallResult(verified),
    confidence: computeConfidence(verified),
    claims: verified,
    summary: buildSummary(verified, required),
    checkedAt: new Date().toISOString(),
  };
}

// -----------------------------------------------------------
// factCheckSession (async)
// -----------------------------------------------------------

export async function factCheckSession(result: AnalysisResult): Promise<AnalysisResult> {
  for (const qr of result.questions) {
    const competitorAnswers = qr.reviews
      .filter((r) => r.answererName !== 'AIC')
      .map((r) => ({ name: r.answererName, answer: r.shortSummary }));

    const aicReview = qr.reviews.find((r) => r.answererName === 'AIC');
    const aicAnswer = aicReview?.shortSummary ?? '';

    qr.factCheck = await factCheckQuestion(
      qr.question,
      qr.questionType,
      aicAnswer,
      competitorAnswers,
    );
  }

  return result;
}
