import { suggestQuestion, suggestSession, DIMENSION_ADVICE } from '../../analysis/suggestion/suggestion';
import { createEmptyResult } from '../../analysis/models/analysis-result';
import type { ReviewResult } from '../../analysis/quality-review/types';
import type { JudgmentResult } from '../../analysis/models/analysis-result';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`✅ ${name}`); }
  catch (e) { failed++; console.log(`❌ ${name}\n   ${(e as Error).message.split('\n')[0]}`); }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

function makeReview(name: string, totalScore: number, overrides?: Record<string, number>): ReviewResult {
  const defaults: Record<string, { score: number; comment: string }> = {
    completeness: { score: overrides?.completeness ?? 4, comment: '' },
    professionalism: { score: overrides?.professionalism ?? 4, comment: '' },
    structure: { score: overrides?.structure ?? 4, comment: '' },
    practicality: { score: overrides?.practicality ?? 4, comment: '' },
    naturalness: { score: overrides?.naturalness ?? 4, comment: '' },
    interaction: { score: overrides?.interaction ?? 0, comment: '不适用' },
  };
  return {
    answererName: name,
    totalScore,
    dimensions: defaults as ReviewResult['dimensions'],
    strengths: [],
    weaknesses: [],
    shortSummary: `${name} ${totalScore}`,
  };
}

function makeJudgment(overrides?: Partial<JudgmentResult>): JudgmentResult {
  return {
    winner: overrides?.winner ?? 'AIC',
    result: overrides?.result ?? 'AIC Better',
    confidence: overrides?.confidence ?? 'High',
    scoreGap: overrides?.scoreGap ?? 10,
    reasons: overrides?.reasons ?? ['Test reason'],
  };
}

console.log('=== Suggestion Engine Tests ===\n');

// ============================================================
// 1. AIC Better → no suggestion
// ============================================================
test('AIC Better → required=false, no suggestion', () => {
  const reviews = [
    makeReview('AIC', 85),
    makeReview('BotA', 70),
  ];
  const judgment = makeJudgment({ result: 'AIC Better' });
  const s = suggestQuestion(reviews, judgment);

  assert(s.required === false, 'required should be false');
  assert(s.summary === 'No suggestion required.', 'Should say no suggestion');
  assert(s.improvementAreas.length === 0, 'No improvement areas');
  assert(s.actionItems.length === 0, 'No action items');
  assert(s.priority === 'Low', 'Priority Low');
});

// ============================================================
// 2. Tie → suggestion generated
// ============================================================
test('Tie → suggestion generated with low-score dimensions', () => {
  const reviews = [
    makeReview('AIC', 75, { structure: 2, naturalness: 2 }),
    makeReview('BotA', 75, { structure: 5, naturalness: 5 }),
  ];
  const judgment = makeJudgment({ result: 'Tie', confidence: 'Medium', scoreGap: 0 });
  const s = suggestQuestion(reviews, judgment);

  assert(s.required === true, 'Tie should require suggestion');
  assert(s.priority === 'Low', 'Tie → Low priority');
  assert(s.improvementAreas.length >= 1, 'Should have improvement areas');
  assert(s.actionItems.length >= 1, 'Should have action items');
  assert(s.summary.includes('建议优先改进'), 'Summary should mention improvement');
});

// ============================================================
// 3. Competitor Better → High priority suggestion
// ============================================================
test('Competitor Better, High confidence → High priority', () => {
  const reviews = [
    makeReview('AIC', 65, { completeness: 1, professionalism: 2 }),
    makeReview('BotA', 88, { completeness: 5, professionalism: 5 }),
  ];
  const judgment = makeJudgment({
    result: 'Competitor Better', confidence: 'High', winner: 'BotA', scoreGap: -23,
  });
  const s = suggestQuestion(reviews, judgment);

  assert(s.required === true, 'Competitor Better → required');
  assert(s.priority === 'High', 'High confidence → High priority');
  assert(s.improvementAreas.length >= 1, 'Has improvement areas');
  assert(s.summary.includes('BotA'), 'Should mention competitor name');
});

// ============================================================
// 4. Competitor Better, Medium confidence → Medium priority
// ============================================================
test('Competitor Better, Medium → Medium priority', () => {
  const reviews = [
    makeReview('AIC', 76, { practicality: 2 }),
    makeReview('BotA', 82, { practicality: 4 }),
  ];
  const judgment = makeJudgment({
    result: 'Competitor Better', confidence: 'Medium', winner: 'BotA', scoreGap: -6,
  });
  const s = suggestQuestion(reviews, judgment);

  assert(s.required === true, 'Required');
  assert(s.priority === 'Medium', 'Medium → Medium priority');
});

// ============================================================
// 5. Multiple low-score dimensions
// ============================================================
test('Multiple low-score dimensions → capped at 3', () => {
  const reviews = [
    makeReview('AIC', 50, {
      completeness: 2, professionalism: 1, structure: 2,
      practicality: 1, naturalness: 2,
    }),
    makeReview('BotA', 85),
  ];
  const judgment = makeJudgment({
    result: 'Competitor Better', confidence: 'High', winner: 'BotA', scoreGap: -35,
  });
  const s = suggestQuestion(reviews, judgment);

  assert(s.required === true, 'Required');
  assert(s.improvementAreas.length <= 3, 'Capped at 3 areas');
  assert(s.actionItems.length <= 3, 'Capped at 3 actions');
});

// ============================================================
// 6. No low dimensions → generic advice
// ============================================================
test('No specific low dimensions → generic advice', () => {
  const reviews = [
    makeReview('AIC', 78, { completeness: 4, professionalism: 3, structure: 4, practicality: 4, naturalness: 3 }),
    makeReview('BotA', 82),
  ];
  const judgment = makeJudgment({
    result: 'Competitor Better', confidence: 'Medium', winner: 'BotA', scoreGap: -4,
  });
  const s = suggestQuestion(reviews, judgment);

  assert(s.required === true, 'Required');
  assert(s.improvementAreas.length >= 1, 'Should have improvement areas from trailing dims (score≤3)');
  // professionalism=3 and naturalness=3 trigger trailingDims
  assert(s.improvementAreas.some((a) => a.includes('Professionalism') || a.includes('Naturalness')), 'Should find trailing dimensions');
});

// ============================================================
// 7. No judgment
// ============================================================
test('No judgment → fallback', () => {
  const reviews = [
    makeReview('AIC', 80),
    makeReview('BotA', 75),
  ];
  const s = suggestQuestion(reviews, null);

  assert(s.required === false, 'No judgment → not required');
  assert(s.summary.includes('No judgment'), 'Should explain');
});

// ============================================================
// 8. No reviews
// ============================================================
test('No reviews → handles gracefully', () => {
  const judgment = makeJudgment({ result: 'Tie', confidence: 'Low' });
  const s = suggestQuestion([], judgment);

  assert(s.required === true, 'Tie → required even without reviews');
  assert(s.improvementAreas.length >= 1, 'Should have generic advice');
});

// ============================================================
// 9. Output structure validation
// ============================================================
test('SuggestionResult has all required fields', () => {
  const reviews = [
    makeReview('AIC', 70, { structure: 2 }),
    makeReview('BotA', 80),
  ];
  const judgment = makeJudgment({ result: 'Competitor Better', confidence: 'High' });
  const s = suggestQuestion(reviews, judgment);

  assert(typeof s.required === 'boolean', 'required is boolean');
  assert(['High', 'Medium', 'Low'].includes(s.priority), 'priority valid');
  assert(Array.isArray(s.improvementAreas), 'improvementAreas array');
  assert(Array.isArray(s.actionItems), 'actionItems array');
  assert(typeof s.summary === 'string', 'summary string');
  assert(s.summary.length > 0, 'summary not empty');
  assert(s.improvementAreas.every((a) => typeof a === 'string'), 'areas are strings');
  assert(s.actionItems.every((a) => typeof a === 'string'), 'actions are strings');
});

// ============================================================
// suggestSession
// ============================================================
console.log('\n--- suggestSession ---\n');

test('suggestSession fills all questions', () => {
  const result = createEmptyResult(
    '2026-07-05',
    [
      { questionIndex: 1, question: 'Q1', questionType: '信息问答', targetFunction: '' },
      { questionIndex: 2, question: 'Q2', questionType: '创作生成', targetFunction: '' },
    ],
    ['AIC', 'BotA'],
    [{ name: 'BotA', freeCount: 5, model: 'GPT-5' }],
  );

  result.questions[0].reviews = [
    makeReview('AIC', 85),
    makeReview('BotA', 70),
  ];
  result.questions[0].judgment = makeJudgment({ result: 'AIC Better' });

  result.questions[1].reviews = [
    makeReview('AIC', 68, { structure: 2 }),
    makeReview('BotA', 82, { structure: 5 }),
  ];
  result.questions[1].judgment = makeJudgment({
    result: 'Competitor Better', confidence: 'High', winner: 'BotA', scoreGap: -14,
  });

  const updated = suggestSession(result);

  // Q1: AIC Better → no suggestion
  assert(updated.questions[0].suggestion!.required === false, 'Q1: no suggestion needed');
  assert(updated.questions[0].suggestion!.summary === 'No suggestion required.', 'Q1: standard message');

  // Q2: Competitor Better → suggestion
  assert(updated.questions[1].suggestion!.required === true, 'Q2: suggestion needed');
  assert(updated.questions[1].suggestion!.priority === 'High', 'Q2: High priority');
  assert(updated.questions[1].suggestion!.improvementAreas.length >= 1, 'Q2: has areas');
});

test('suggestSession handles questions without judgment', () => {
  const result = createEmptyResult(
    '2026-07-05',
    [{ questionIndex: 1, question: 'Q1', questionType: '信息问答', targetFunction: '' }],
    ['BotA'],
    [{ name: 'BotA', freeCount: 5, model: 'GPT-5' }],
  );
  result.questions[0].reviews = [makeReview('AIC', 80)];
  result.questions[0].judgment = null;

  const updated = suggestSession(result);
  assert(updated.questions[0].suggestion!.required === false, 'No judgment → not required');
});

// ============================================================
// Dimension advice is configurable
// ============================================================
test('Dimension advice mapping is complete for all 6 dims', () => {
  const dims = ['completeness', 'professionalism', 'structure', 'practicality', 'naturalness', 'interaction'];
  for (const dim of dims) {
    assert(dim in DIMENSION_ADVICE, `${dim} should have advice`);
    assert(DIMENSION_ADVICE[dim].area.length > 0, `${dim} area not empty`);
    assert(DIMENSION_ADVICE[dim].action.length > 0, `${dim} action not empty`);
  }
});

console.log(`\n=== ${passed}/${passed + failed} passed ===`);
if (failed > 0) process.exit(1);
