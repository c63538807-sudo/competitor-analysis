import { judgeQuestion, judgeSession, DEFAULT_THRESHOLDS } from '../../analysis/judgment/judgment';
import { createEmptyResult } from '../../analysis/models/analysis-result';
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

function makeComparison(ranking: { name: string; totalScore: number }[]): ComparisonResult {
  return {
    ranking: ranking.map((r, i) => ({ answererName: r.name, rank: i + 1, totalScore: r.totalScore })),
    scoreTable: ranking.map((r) => ({
      answererName: r.name,
      totalScore: r.totalScore,
      dimensions: { completeness: 3, professionalism: 3, structure: 3, practicality: 3, naturalness: 3, interaction: 0 },
    })),
    dimensionComparison: [],
    keyDifferences: [],
    analysisSummary: '',
  };
}

console.log('=== Judgment Engine Tests ===\n');

// ============================================================
// judgeQuestion
// ============================================================

// 1. AIC big lead (gap ≥ 8)
test('AIC big lead (gap=15) → AIC Better, High', () => {
  const comp = makeComparison([
    { name: 'AIC', totalScore: 90 },
    { name: 'BotA', totalScore: 75 },
  ]);
  const j = judgeQuestion(comp);
  assert(j.result === 'AIC Better', `Expected AIC Better, got ${j.result}`);
  assert(j.winner === 'AIC', 'Winner should be AIC');
  assert(j.confidence === 'High', 'High confidence');
  assert(j.scoreGap === 15, 'Gap = 15');
  assert(j.reasons.length >= 2, 'Should have reasons');
});

// 2. AIC slight lead (gap 4–7)
test('AIC slight lead (gap=5) → AIC Better, Medium', () => {
  const comp = makeComparison([
    { name: 'AIC', totalScore: 82 },
    { name: 'BotA', totalScore: 77 },
  ]);
  const j = judgeQuestion(comp);
  assert(j.result === 'AIC Better', `Expected AIC Better, got ${j.result}`);
  assert(j.winner === 'AIC', 'Winner = AIC');
  assert(j.confidence === 'Medium', 'Medium confidence');
  assert(j.scoreGap === 5, 'Gap = 5');
});

// 3. AIC narrow edge (gap=4 — borderline)
test('AIC borderline (gap=4) → AIC Better, Medium', () => {
  const comp = makeComparison([
    { name: 'AIC', totalScore: 80 },
    { name: 'BotA', totalScore: 76 },
  ]);
  const j = judgeQuestion(comp);
  assert(j.result === 'AIC Better', 'Should be AIC Better at gap=4');
  assert(j.confidence === 'Medium', 'Medium at border');
});

// 4. Exact tie (gap=0)
test('Exact tie (gap=0) → Tie, High', () => {
  const comp = makeComparison([
    { name: 'AIC', totalScore: 75 },
    { name: 'BotA', totalScore: 75 },
  ]);
  const j = judgeQuestion(comp);
  assert(j.result === 'Tie', `Expected Tie, got ${j.result}`);
  assert(j.winner === '—', 'Winner should be —');
  assert(j.confidence === 'High', 'Exact tie = High confidence');
  assert(j.scoreGap === 0, 'Gap = 0');
});

// 5. Near tie (gap=2)
test('Near tie (gap=2) → Tie, Medium', () => {
  const comp = makeComparison([
    { name: 'AIC', totalScore: 77 },
    { name: 'BotA', totalScore: 75 },
  ]);
  const j = judgeQuestion(comp);
  assert(j.result === 'Tie', 'gap=2 should be Tie');
  assert(j.confidence === 'Medium', 'Medium for small tie');
  assert(j.scoreGap === 2, 'Gap = 2');
});

// 6. Slight tie edge (gap=3)
test('Tie edge (gap=3) → Tie, Low', () => {
  const comp = makeComparison([
    { name: 'AIC', totalScore: 78 },
    { name: 'BotA', totalScore: 75 },
  ]);
  const j = judgeQuestion(comp);
  assert(j.result === 'Tie', 'gap=3 should be Tie');
  assert(j.confidence === 'Low', 'Low confidence near boundary');
});

// 7. Competitor slight lead (gap=-5)
test('Competitor slight lead (gap=-5) → Competitor Better, Medium', () => {
  const comp = makeComparison([
    { name: 'BotA', totalScore: 85 },
    { name: 'AIC', totalScore: 80 },
  ]);
  const j = judgeQuestion(comp);
  assert(j.result === 'Competitor Better', `Expected Competitor Better, got ${j.result}`);
  assert(j.winner === 'BotA', 'Winner = BotA');
  assert(j.confidence === 'Medium', 'Medium');
  assert(j.scoreGap === -5, 'Gap = -5');
});

// 8. Competitor big lead (gap=-12)
test('Competitor big lead (gap=-12) → Competitor Better, High', () => {
  const comp = makeComparison([
    { name: 'BotA', totalScore: 90 },
    { name: 'AIC', totalScore: 78 },
  ]);
  const j = judgeQuestion(comp);
  assert(j.result === 'Competitor Better', 'Competitor Better');
  assert(j.winner === 'BotA', 'Winner = BotA');
  assert(j.confidence === 'High', 'High confidence');
  assert(j.scoreGap === -12, 'Gap = -12');
});

// 9. Multi-competitor (AIC vs best competitor)
test('Multi-competitor: AIC beats best, ignores others', () => {
  const comp = makeComparison([
    { name: 'AIC', totalScore: 88 },
    { name: 'BotB', totalScore: 82 },
    { name: 'BotA', totalScore: 65 },
  ]);
  const j = judgeQuestion(comp);
  // Gap = 88 - 82 = 6 → AIC Better, Medium
  assert(j.result === 'AIC Better', 'AIC Better vs best competitor');
  assert(j.scoreGap === 6, 'Gap = AIC - bestCompetitor');
  assert(j.confidence === 'Medium', 'Medium');
});

test('Multi-competitor: competitor beats AIC', () => {
  const comp = makeComparison([
    { name: 'BotA', totalScore: 90 },
    { name: 'BotB', totalScore: 85 },
    { name: 'AIC', totalScore: 70 },
  ]);
  const j = judgeQuestion(comp);
  // Gap = 70 - 90 = -20 → Competitor Better, High
  assert(j.result === 'Competitor Better', 'Competitor Better');
  assert(j.winner === 'BotA', 'Best competitor wins');
  assert(j.scoreGap === -20, 'Gap = -20');
});

// 10. Only AIC (no competitors)
test('Only AIC → AIC Better by default', () => {
  const comp = makeComparison([{ name: 'AIC', totalScore: 75 }]);
  const j = judgeQuestion(comp);
  assert(j.result === 'AIC Better', 'Only AIC should win');
  assert(j.winner === 'AIC', 'Winner = AIC');
  assert(j.confidence === 'High', 'High — no competition');
});

// 11. Empty comparison
test('Empty comparison → Tie, Low', () => {
  const comp: ComparisonResult = {
    ranking: [],
    scoreTable: [],
    dimensionComparison: [],
    keyDifferences: [],
    analysisSummary: '',
  };
  const j = judgeQuestion(comp);
  assert(j.result === 'Tie', 'Empty → Tie');
  assert(j.confidence === 'Low', 'Low — no data');
  assert(j.reasons.length >= 1, 'Should explain why');
});

// 12. Custom thresholds
test('Custom thresholds change behavior', () => {
  // gap=3: default → Tie (within ±3). Custom tieMax=1 → AIC Better
  const comp = makeComparison([
    { name: 'AIC', totalScore: 80 },
    { name: 'BotA', totalScore: 77 },
  ]);
  const jDefault = judgeQuestion(comp);
  assert(jDefault.result === 'Tie', `Default (tieMax=3): gap=3 → Tie, got ${jDefault.result}`);

  const strict = { ...DEFAULT_THRESHOLDS, tieMax: 1, aicBetterMedium: 2 };
  const jStrict = judgeQuestion(comp, strict);
  assert(jStrict.result === 'AIC Better', `Strict (tieMax=1): gap=3 → AIC Better, got ${jStrict.result}`);

  // gap=-5 with relaxed competitor threshold
  const comp2 = makeComparison([
    { name: 'BotA', totalScore: 85 },
    { name: 'AIC', totalScore: 80 },
  ]);
  const relaxed = { ...DEFAULT_THRESHOLDS, competitorBetterMedium: -6 };
  const jRelaxed = judgeQuestion(comp2, relaxed);
  // gap=-5 >= -6 → Competitor Better, Medium
  assert(jRelaxed.result === 'Competitor Better', 'Relaxed: gap=-5 → Competitor Better');
  assert(jRelaxed.confidence === 'Medium', 'Medium confidence');
});

// ============================================================
// judgeSession
// ============================================================
console.log('\n--- judgeSession ---\n');

test('judgeSession fills all questions with comparison', () => {
  const result = createEmptyResult(
    '2026-07-05',
    [
      { questionIndex: 1, question: 'Q1', questionType: '信息问答', targetFunction: '' },
      { questionIndex: 2, question: 'Q2', questionType: '创作生成', targetFunction: '' },
    ],
    ['AIC', 'BotA'],
    [{ name: 'BotA', freeCount: 5, model: 'GPT-5' }],
  );

  result.questions[0].comparison = makeComparison([
    { name: 'AIC', totalScore: 90 },
    { name: 'BotA', totalScore: 70 },
  ]);
  result.questions[1].comparison = makeComparison([
    { name: 'BotA', totalScore: 85 },
    { name: 'AIC', totalScore: 78 },
  ]);

  const updated = judgeSession(result);

  assert(updated.questions[0].judgment!.result === 'AIC Better', 'Q1: AIC Better');
  assert(updated.questions[1].judgment!.result === 'Competitor Better', 'Q2: Competitor Better');
});

test('judgeSession skips questions without comparison', () => {
  const result = createEmptyResult(
    '2026-07-05',
    [{ questionIndex: 1, question: 'Q1', questionType: '信息问答', targetFunction: '' }],
    ['BotA'],
    [{ name: 'BotA', freeCount: 5, model: 'GPT-5' }],
  );
  const updated = judgeSession(result);
  assert(updated.questions[0].judgment === null, 'No comparison → judgment null');
});

// ============================================================
// Integration: comparison → judgment
// ============================================================
console.log('\n--- Integration ---\n');

test('Full pipeline: comparison feeds judgment correctly', () => {
  const comp = makeComparison([
    { name: 'AIC', totalScore: 88 },
    { name: 'BotA', totalScore: 75 },
    { name: 'BotB', totalScore: 72 },
  ]);
  const j = judgeQuestion(comp);

  assert(j.result === 'AIC Better', 'AIC Better');
  assert(j.winner === 'AIC', 'AIC wins');
  assert(j.scoreGap === 13, 'Gap = 13');
  assert(j.confidence === 'High', 'High confidence');
  assert(j.reasons.length >= 2, 'At least 2 reasons');
  // Reasons should be objective
  for (const r of j.reasons) {
    assert(r.length > 0, 'Reason should not be empty');
  }
});

test('Judgment output is fully structured', () => {
  const comp = makeComparison([
    { name: 'AIC', totalScore: 82 },
    { name: 'BotA', totalScore: 78 },
  ]);
  const j = judgeQuestion(comp);

  assert(typeof j.winner === 'string', 'winner is string');
  assert(['AIC Better', 'Competitor Better', 'Tie'].includes(j.result), 'result valid');
  assert(['High', 'Medium', 'Low'].includes(j.confidence), 'confidence valid');
  assert(typeof j.scoreGap === 'number', 'scoreGap is number');
  assert(Array.isArray(j.reasons), 'reasons is array');
  assert(j.reasons.every((r) => typeof r === 'string'), 'all reasons are strings');
});

console.log(`\n=== ${passed}/${passed + failed} passed ===`);
if (failed > 0) process.exit(1);
