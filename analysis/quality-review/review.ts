// ============================================================
// Quality Review — Review Functions
// ============================================================

import type { ExportPayload } from '../../types';
import type { DimensionId, ReviewResult, ReviewContext } from './types';
import { reviewAnswer as scoreAnswer, type ScorerFn } from './scorer';
import { createEmptyResult, type AnalysisResult } from '../models/analysis-result';

// -----------------------------------------------------------
// reviewAnswer
// -----------------------------------------------------------

/**
 * Evaluate a single answer independently.
 *
 * Usage:
 *   const result = reviewAnswer(
 *     "2025年诺贝尔奖得主是谁？",
 *     "信息问答",
 *     "2025年诺贝尔物理学奖授予了...",
 *     "AIC"
 *   );
 */
export function reviewAnswer(
  questionText: string,
  questionType: string,
  answerText: string,
  answererName: string,
  context?: ReviewContext,
  scorer?: ScorerFn,
): ReviewResult {
  return scoreAnswer(
    questionText,
    questionType,
    answerText,
    answererName,
    context,
    scorer,
  );
}

// -----------------------------------------------------------
// reviewQuestion
// -----------------------------------------------------------

export interface QuestionReviews {
  questionIndex: number;
  questionText: string;
  questionType: string;
  reviews: ReviewResult[];
}

/**
 * Evaluate all answers (AIC + all competitors) for a single question.
 * Does NOT compare them — only produces individual reviews.
 */
export function reviewQuestion(
  questionIndex: number,
  questionText: string,
  questionType: string,
  aicAnswer: string,
  competitors: { name: string; answer: string }[],
  context?: ReviewContext,
  scorer?: ScorerFn,
): QuestionReviews {
  const reviews: ReviewResult[] = [];

  reviews.push(
    scoreAnswer(questionText, questionType, aicAnswer, 'AIC', context, scorer),
  );

  for (const comp of competitors) {
    reviews.push(
      scoreAnswer(questionText, questionType, comp.answer, comp.name, context, scorer),
    );
  }

  return {
    questionIndex,
    questionText,
    questionType,
    reviews,
  };
}

// -----------------------------------------------------------
// reviewSession — unified AnalysisResult output
// -----------------------------------------------------------

/**
 * Evaluate every answer in an ExportPayload, and write the results
 * into a unified AnalysisResult.
 *
 * This is the PRIMARY entry point for Quality Review.
 * It populates `result.questions[].reviews` for every (question × answerer) pair.
 *
 * Future agents (Comparison, Judgment, Fact Check, Suggestion, Summary)
 * all modify the SAME AnalysisResult object — no new result types.
 */
export function reviewSession(
  payload: ExportPayload,
  context?: ReviewContext,
  scorer?: ScorerFn,
): AnalysisResult {
  // Collect competitor names
  const competitorNames = new Set<string>();
  for (const q of payload.questions) {
    for (const c of q.competitors) {
      competitorNames.add(c.name);
    }
  }

  // Create the result shell
  const result = createEmptyResult(
    payload.date,
    payload.questions.map((q) => ({
      questionIndex: q.questionIndex,
      question: q.question,
      questionType: q.questionType,
      targetFunction: q.targetFunction ?? '',
    })),
    Array.from(competitorNames),
    payload.competitorMeta.map((m) => ({
      name: m.name,
      freeCount: m.freeCount,
      model: m.model,
    })),
  );

  // Fill reviews for each question
  for (let i = 0; i < payload.questions.length; i++) {
    const q = payload.questions[i];
    const comps = q.competitors.map((c) => ({ name: c.name, answer: c.answer }));

    const qReviews = reviewQuestion(
      q.questionIndex,
      q.question,
      q.questionType,
      q.aic.answer,
      comps,
      context,
      scorer,
    );

    // Write reviews into the AnalysisResult
    result.questions[i].reviews = qReviews.reviews;
  }

  return result;
}
