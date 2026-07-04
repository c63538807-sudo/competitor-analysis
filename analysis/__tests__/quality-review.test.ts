import { reviewAnswer, reviewQuestion, reviewSession } from '../../analysis/quality-review/review';
import type { ExportPayload } from '../../types';
import type { DimensionId } from '../../analysis/quality-review/types';
import type { AnalysisResult, QuestionResult } from '../../analysis/models/analysis-result';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (e) {
    failed++;
    const msg = e instanceof Error ? e.message.split('\n')[0] : String(e);
    console.log(`❌ ${name}`);
    console.log(`   ${msg}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

console.log('=== Quality Review + Unified Model Tests ===\n');

// ============================================================
// reviewAnswer (unchanged)
// ============================================================
console.log('--- reviewAnswer ---\n');

test('Empty answer scores low', () => {
  const r = reviewAnswer('What is AI?', '信息问答', '', 'TestBot');
  assert(r.totalScore <= 40, `Empty answer should score <=40, got ${r.totalScore}`);
  assert(r.dimensions.completeness.score === 1, 'Empty: completeness should be 1');
  assert(r.weaknesses.length >= 3, 'Empty: should have multiple weaknesses');
});

test('Long structured answer scores high', () => {
  const answer = [
    '## Introduction',
    'AI refers to the simulation of human intelligence in machines.',
    '',
    '## Key Components',
    '1. Machine Learning — algorithms that improve through experience',
    '2. NLP — understanding human language',
    '3. Computer Vision — interpreting visual information',
    '',
    '## Summary',
    'AI is a transformative technology. Feel free to ask for details!',
  ].join('\n');

  const r = reviewAnswer('What is AI?', '信息问答', answer, 'TestBot');
  assert(r.totalScore >= 60, `Structured answer should score >=60, got ${r.totalScore}`);
  assert(r.strengths.length >= 1, 'Should identify strengths');
  assert(r.dimensions.structure.score >= 3, 'Good structure should score well');
});

test('All 6 dimensions are scored', () => {
  const r = reviewAnswer('Q', '信息问答', 'A reasonable answer.', 'Bot');
  const dims: DimensionId[] = ['completeness', 'professionalism', 'structure', 'practicality', 'naturalness', 'interaction'];
  for (const dim of dims) {
    assert(dim in r.dimensions, `Missing dimension: ${dim}`);
    const d = r.dimensions[dim];
    assert(d.score >= 0 && d.score <= 5, `${dim} score out of range: ${d.score}`);
    assert(typeof d.comment === 'string', `${dim} comment should be string`);
  }
});

test('Zero-weight dimensions → score=0, 不适用', () => {
  const r = reviewAnswer('Q', '信息问答', 'Some answer.', 'Bot');
  assert(r.dimensions.interaction.score === 0, 'interaction weight=0 for 信息问答');
  assert(r.dimensions.interaction.comment === '不适用', 'Should say 不适用');
});

// ============================================================
// reviewSession → AnalysisResult
// ============================================================
console.log('\n--- reviewSession → AnalysisResult ---\n');

const samplePayload: ExportPayload = {
  date: '2026-07-05',
  questions: [
    {
      questionIndex: 1,
      question: 'What is TypeScript?',
      questionType: '信息问答',
      targetFunction: '',
      aic: { answer: 'TypeScript is a typed superset of JavaScript that compiles to plain JS.', screenshot: '', evaluation: '' },
      competitors: [
        { name: 'BotA', answer: 'TypeScript adds static types to JavaScript.', screenshot: '' },
      ],
      competitorEvaluation: '',
      overallJudgment: '',
      notes: '',
    },
    {
      questionIndex: 2,
      question: 'Write a hello world function',
      questionType: '工具类',
      targetFunction: '',
      aic: { answer: 'function hello() { console.log("Hello, world!"); }', screenshot: '', evaluation: '' },
      competitors: [
        { name: 'BotA', answer: 'console.log("hello");', screenshot: '' },
      ],
      competitorEvaluation: '',
      overallJudgment: '',
      notes: '',
    },
  ],
  competitorMeta: [{ name: 'BotA', freeCount: 5, model: 'GPT-5' }],
};

test('reviewSession returns AnalysisResult with session info', () => {
  const result = reviewSession(samplePayload);
  assert(result.session.date === '2026-07-05', 'Date should be preserved');
  assert(result.session.questionCount === 2, 'Should have 2 questions');
  assert(result.session.competitorCount === 1, 'Should have 1 competitor');
  assert(result.session.competitorNames[0] === 'BotA', 'Competitor name');
  assert(result.session.competitorMeta.length === 1, 'Should have competitorMeta');
  assert(result.session.competitorMeta[0].model === 'GPT-5', 'Model should be preserved');
});

test('reviewSession fills questions[].reviews correctly', () => {
  const result = reviewSession(samplePayload);
  assert(result.questions.length === 2, 'Should have 2 QuestionResults');

  for (const qr of result.questions) {
    assert(qr.reviews.length === 2, `Q${qr.questionIndex}: expected 2 reviews (AIC+BotA), got ${qr.reviews.length}`);
    assert(qr.reviews[0].answererName === 'AIC', 'First review should be AIC');
    assert(qr.reviews[1].answererName === 'BotA', 'Second review should be BotA');

    for (const review of qr.reviews) {
      assert(typeof review.totalScore === 'number', 'totalScore should be number');
      assert(review.totalScore >= 0 && review.totalScore <= 100, `totalScore out of range: ${review.totalScore}`);
      assert(Array.isArray(review.strengths), 'strengths should be array');
      assert(Array.isArray(review.weaknesses), 'weaknesses should be array');
      assert(review.shortSummary.length > 0, 'shortSummary should not be empty');
    }
  }
});

test('AnalysisResult question fields are populated', () => {
  const result = reviewSession(samplePayload);
  for (const qr of result.questions) {
    assert(typeof qr.questionIndex === 'number', 'questionIndex');
    assert(qr.question.length > 0, 'question text');
    assert(qr.questionType.length > 0, 'questionType');
  }
});

test('All placeholder fields are null (ready for future agents)', () => {
  const result = reviewSession(samplePayload);
  for (const qr of result.questions) {
    assert(qr.comparison === null, 'comparison should be null (not yet filled)');
    assert(qr.judgment === null, 'judgment should be null (not yet filled)');
    assert(qr.suggestion === null, 'suggestion should be null (not yet filled)');
    assert(qr.factCheck === null, 'factCheck should be null (not yet filled)');
  }
});

test('Summary placeholder is empty but structurally valid', () => {
  const result = reviewSession(samplePayload);
  assert(result.summary.overallAssessment === '', 'overallAssessment empty');
  assert(Array.isArray(result.summary.strengths), 'strengths is array');
  assert(Array.isArray(result.summary.weaknesses), 'weaknesses is array');
  assert(Array.isArray(result.summary.recommendations), 'recommendations is array');
  assert(typeof result.summary.winLossSummary === 'object', 'winLossSummary is object');
  assert(result.summary.winLossSummary.aicWins === 0, 'aicWins starts at 0');
});

// ============================================================
// Future Agent integration contracts
// ============================================================
console.log('\n--- Future Agent Integration Contracts ---\n');

test('reviewAnswer accepts ReviewContext (Fact Check ready)', () => {
  const r = reviewAnswer('Q', '信息问答', 'AI is magic.', 'Bot', { factCheckFailed: true });
  assert(r.dimensions.professionalism.score <= 2, 'Fact check fail caps professionalism');
  assert(r.dimensions.completeness.score <= 2, 'Fact check fail caps completeness');
});

test('reviewAnswer accepts custom scorer (LLM-ready)', () => {
  const customScorer = (_qText: string, _qType: string, _aText: string, aName: string) => ({
    answererName: aName,
    totalScore: 99,
    dimensions: {
      completeness: { score: 5, comment: 'Perfect' },
      professionalism: { score: 5, comment: 'Perfect' },
      structure: { score: 5, comment: 'Perfect' },
      practicality: { score: 5, comment: 'Perfect' },
      naturalness: { score: 5, comment: 'Perfect' },
      interaction: { score: 5, comment: 'Perfect' },
    },
    strengths: ['Everything'],
    weaknesses: [],
    shortSummary: 'Perfect.',
  });
  const r = reviewAnswer('Q', '信息问答', 'A', 'Bot', undefined, customScorer);
  assert(r.totalScore === 99, 'Custom scorer produces its own score');
});

test('AnalysisResult can be round-tripped through JSON', () => {
  const result = reviewSession(samplePayload);
  const json = JSON.stringify(result, null, 2);
  const parsed = JSON.parse(json) as AnalysisResult;

  assert(parsed.session.date === '2026-07-05', 'Round-trip: date');
  assert(parsed.questions.length === 2, 'Round-trip: questions');
  assert(parsed.questions[0].reviews.length === 2, 'Round-trip: reviews');
  assert(parsed.questions[0].comparison === null, 'Round-trip: null fields preserved');
  assert(parsed.questions[0].judgment === null, 'Round-trip: null fields preserved');
});

console.log(`\n=== ${passed}/${passed + failed} passed ===`);
if (failed > 0) process.exit(1);
