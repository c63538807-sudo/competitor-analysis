import { compareQuestion, compareSession } from '../../analysis/comparison/comparison';
import { reviewAnswer } from '../../analysis/quality-review/review';
import { createEmptyResult } from '../../analysis/models/analysis-result';
import type { ReviewResult } from '../../analysis/quality-review/types';
import type { ComparisonResult } from '../../analysis/models/analysis-result';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`✅ ${name}`); }
  catch (e) { failed++; console.log(`❌ ${name}\n   ${(e as Error).message.split('\n')[0]}`); }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

function makeReview(name: string, totalScore: number, overrides?: Partial<Record<string, number>>): ReviewResult {
  const dims = {
    completeness: { score: 3, comment: '' },
    professionalism: { score: 3, comment: '' },
    structure: { score: 3, comment: '' },
    practicality: { score: 3, comment: '' },
    naturalness: { score: 3, comment: '' },
    interaction: { score: 3, comment: '' },
    ...Object.fromEntries(
      Object.entries(overrides ?? {}).map(([k, v]) => [k, { score: v as number, comment: '' }]),
    ),
  } as ReviewResult['dimensions'];

  return {
    answererName: name,
    totalScore,
    dimensions: dims,
    strengths: [],
    weaknesses: [],
    shortSummary: `${name} scored ${totalScore}`,
  };
}

console.log('=== Comparison Engine Tests ===\n');

// ============================================================
// compareQuestion
// ============================================================
console.log('--- compareQuestion ---\n');

// 1. AIC scores highest
test('AIC first — correct ranking', () => {
  const reviews = [
    makeReview('AIC', 85),
    makeReview('BotA', 72),
    makeReview('BotB', 68),
  ];
  const result = compareQuestion(reviews);
  assert(result.ranking[0].answererName === 'AIC', 'AIC should be rank 1');
  assert(result.ranking[0].rank === 1, 'rank should be 1');
  assert(result.ranking[1].answererName === 'BotA', 'BotA should be rank 2');
  assert(result.ranking[2].answererName === 'BotB', 'BotB should be rank 3');
});

// 2. Competitor scores highest
test('Competitor first — correct ranking', () => {
  const reviews = [
    makeReview('AIC', 68),
    makeReview('BotA', 90),
  ];
  const result = compareQuestion(reviews);
  assert(result.ranking[0].answererName === 'BotA', 'BotA should be rank 1');
  assert(result.ranking[0].totalScore === 90, 'BotA score should be 90');
  assert(result.ranking[1].answererName === 'AIC', 'AIC should be rank 2');
});

// 3. Equal scores
test('Equal scores — both rank 2', () => {
  const reviews = [
    makeReview('AIC', 75),
    makeReview('BotA', 75),
  ];
  const result = compareQuestion(reviews);
  // Both have rank 1 and 2 respectively (stable sort by array order)
  assert(result.ranking[0].totalScore === 75, 'Both should have 75');
  assert(result.ranking[1].totalScore === 75, 'Both should have 75');
  assert(result.ranking.length === 2, 'Should have 2 entries');
});

// 4. Three competitors
test('Three competitors — full ranking', () => {
  const reviews = [
    makeReview('AIC', 88),
    makeReview('BotA', 72),
    makeReview('BotB', 65),
    makeReview('BotC', 79),
  ];
  const result = compareQuestion(reviews);
  assert(result.ranking.length === 4, '4 entries in ranking');
  assert(result.ranking[0].answererName === 'AIC', 'AIC rank 1');
  assert(result.ranking[3].answererName === 'BotB', 'BotB rank 4');
});

// 5. Empty answer (score=0)
test('Empty answer — ranks last', () => {
  const reviews = [
    makeReview('AIC', 80),
    makeReview('BotA', 0),
  ];
  const result = compareQuestion(reviews);
  assert(result.ranking[0].answererName === 'AIC', 'AIC rank 1');
  assert(result.ranking[1].answererName === 'BotA', 'BotA rank 2 (last)');
  assert(result.ranking[1].totalScore === 0, 'BotA score 0');
});

// 6. Score table structure
test('scoreTable includes all answerers with dimension scores', () => {
  const reviews = [
    makeReview('AIC', 85, { completeness: 5, structure: 4 }),
    makeReview('BotA', 72, { completeness: 3, structure: 2 }),
  ];
  const result = compareQuestion(reviews);
  assert(result.scoreTable.length === 2, '2 entries in scoreTable');

  const aicRow = result.scoreTable.find((r) => r.answererName === 'AIC');
  assert(aicRow !== undefined, 'AIC should be in scoreTable');
  assert(aicRow!.totalScore === 85, 'AIC totalScore');
  assert(aicRow!.dimensions.completeness === 5, 'AIC completeness=5');
  assert(aicRow!.dimensions.structure === 4, 'AIC structure=4');

  const botRow = result.scoreTable.find((r) => r.answererName === 'BotA');
  assert(botRow !== undefined, 'BotA should be in scoreTable');
  assert(botRow!.dimensions.structure === 2, 'BotA structure=2');
});

// 7. Dimension comparison identifies leaders
test('dimensionComparison identifies per-dimension leaders', () => {
  const reviews = [
    makeReview('AIC', 80, { completeness: 5, professionalism: 3 }),
    makeReview('BotA', 75, { completeness: 3, professionalism: 5 }),
  ];
  const result = compareQuestion(reviews);

  const compDim = result.dimensionComparison.find((d) => d.dimension === 'completeness');
  assert(compDim !== undefined, 'Should have completeness comparison');
  assert(compDim!.leader === 'AIC', 'AIC leads completeness');
  assert(compDim!.scores['AIC'] === 5, 'AIC completeness=5');
  assert(compDim!.scores['BotA'] === 3, 'BotA completeness=3');

  const profDim = result.dimensionComparison.find((d) => d.dimension === 'professionalism');
  assert(profDim!.leader === 'BotA', 'BotA leads professionalism');
});

// 8. Key differences detected (gap ≥ 2)
test('keyDifferences captures gaps ≥ 2', () => {
  const reviews = [
    makeReview('AIC', 85, { completeness: 5, structure: 3 }),
    makeReview('BotA', 72, { completeness: 2, structure: 3 }),
  ];
  const result = compareQuestion(reviews);
  const compDiff = result.keyDifferences.find((d) => d.dimension === 'completeness');
  assert(compDiff !== undefined, 'Should detect completeness gap');
  assert(compDiff!.gap === 3, 'Gap should be 3');
  assert(compDiff!.leader === 'AIC', 'AIC leads');
  assert(compDiff!.description.includes('明显领先'), 'Should mention 明显领先');

  // structure: both score 3, gap=0 < 2 → NOT in keyDifferences
  const structDiff = result.keyDifferences.find((d) => d.dimension === 'structure');
  assert(structDiff === undefined, 'structure should not be in keyDifferences (gap=0)');
});

// 9. analysisSummary is objective (no winner declaration)
test('analysisSummary is objective — no "AIC更优" language', () => {
  const reviews = [
    makeReview('AIC', 85, { completeness: 5 }),
    makeReview('BotA', 72, { completeness: 2 }),
  ];
  const result = compareQuestion(reviews);
  assert(result.analysisSummary.length > 0, 'Summary should not be empty');
  assert(!result.analysisSummary.includes('AIC更优'), 'Should NOT contain AIC更优');
  assert(!result.analysisSummary.includes('竞品更优'), 'Should NOT contain 竞品更优');
  assert(!result.analysisSummary.includes('平局'), 'Should NOT contain 平局');
  assert(result.analysisSummary.includes('综合得分最高'), 'Should contain 综合得分最高');
});

// 10. No reviews → empty result
test('No reviews returns meaningful comparison', () => {
  const result = compareQuestion([]);
  assert(result.ranking.length === 0, 'Empty ranking');
  assert(result.scoreTable.length === 0, 'Empty scoreTable');
  assert(result.analysisSummary.length === 0, 'Empty summary');
});

// ============================================================
// compareSession
// ============================================================
console.log('\n--- compareSession ---\n');

test('compareSession fills all questions[].comparison', () => {
  const result = createEmptyResult(
    '2026-07-05',
    [
      { questionIndex: 1, question: 'Q1', questionType: '信息问答', targetFunction: '' },
      { questionIndex: 2, question: 'Q2', questionType: '创作生成', targetFunction: '' },
    ],
    ['AIC', 'BotA'],
    [{ name: 'BotA', freeCount: 5, model: 'GPT-5' }],
  );

  // Fill reviews manually
  result.questions[0].reviews = [
    makeReview('AIC', 85, { completeness: 5, professionalism: 4 }),
    makeReview('BotA', 72, { completeness: 3, professionalism: 3 }),
  ];
  result.questions[1].reviews = [
    makeReview('AIC', 70, { naturalness: 3 }),
    makeReview('BotA', 80, { naturalness: 5 }),
  ];

  const updated = compareSession(result);

  // Q1
  assert(updated.questions[0].comparison !== null, 'Q1 comparison should be filled');
  assert(updated.questions[0].comparison!.ranking.length === 2, 'Q1: 2 in ranking');
  assert(updated.questions[0].comparison!.ranking[0].answererName === 'AIC', 'Q1: AIC first');

  // Q2
  assert(updated.questions[1].comparison !== null, 'Q2 comparison should be filled');
  assert(updated.questions[1].comparison!.ranking[0].answererName === 'BotA', 'Q2: BotA first');
});

test('compareSession skips questions with no reviews', () => {
  const result = createEmptyResult(
    '2026-07-05',
    [{ questionIndex: 1, question: 'Q1', questionType: '信息问答', targetFunction: '' }],
    ['BotA'],
    [{ name: 'BotA', freeCount: 5, model: 'GPT-5' }],
  );
  // Leave reviews empty
  const updated = compareSession(result);
  assert(updated.questions[0].comparison === null, 'No reviews → comparison should be null');
});

// ============================================================
// Integration: reviewSession → compareSession
// ============================================================
console.log('\n--- Integration ---\n');

test('Full pipeline: review → compare', () => {
  const aicReview = reviewAnswer(
    'What is TypeScript?', '信息问答',
    'TypeScript is a typed superset of JavaScript developed by Microsoft. It adds optional static typing, interfaces, and generics. It compiles to plain JavaScript for browser compatibility.',
    'AIC',
  );
  const botReview = reviewAnswer(
    'What is TypeScript?', '信息问答',
    'TypeScript adds types to JS.',
    'BotA',
  );

  const reviews = [aicReview, botReview];
  const comparison = compareQuestion(reviews);

  assert(comparison.ranking.length === 2, '2 ranked');
  assert(comparison.scoreTable.length === 2, '2 in scoreTable');
  assert(comparison.dimensionComparison.length === 6, '6 dimensions compared');
  assert(comparison.analysisSummary.length > 0, 'Summary present');
  // AIC's longer, structured answer should rank higher
  assert(comparison.ranking[0].answererName === 'AIC', 'AIC should rank higher with detailed answer');
});

console.log(`\n=== ${passed}/${passed + failed} passed ===`);
if (failed > 0) process.exit(1);
