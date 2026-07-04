import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadTodayJson, validateTodayJson, parseTodayJson } from '../../analysis/reader';
import { getSessionInfo } from '../../analysis/index';

const tmpDir = `/tmp/analysis-test-${Date.now()}`;

function setup() {
  fs.mkdirSync(tmpDir, { recursive: true });
}

function teardown() {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

function writeJSON(name: string, data: unknown): string {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  return p;
}

const validPayload = {
  date: '2026-07-05',
  questions: [
    {
      questionIndex: 1,
      question: 'Test question?',
      questionType: '信息问答' as const,
      targetFunction: '',
      aic: { answer: 'A', screenshot: '', evaluation: '' },
      competitors: [{ name: 'Comp1', answer: 'B', screenshot: '' }],
      competitorEvaluation: '',
      overallJudgment: '',
      notes: '',
    },
  ],
  competitorMeta: [{ name: 'Comp1', freeCount: 3, model: 'GPT-5' }],
};

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

// ============================================================
console.log('=== Analysis Reader Tests ===\n');

setup();

// --- Valid JSON ---
test('Valid JSON — load + parse', () => {
  const p = writeJSON('valid.json', validPayload);
  const raw = loadTodayJson(p);
  const result = parseTodayJson(raw);
  if (!result.valid) throw new Error(JSON.stringify(result.errors));
  if (result.data!.date !== '2026-07-05') throw new Error('Date');
  if (result.data!.questions.length !== 1) throw new Error('Q count');
});

test('Valid JSON — getSessionInfo', () => {
  const p = writeJSON('valid2.json', validPayload);
  const raw = loadTodayJson(p);
  const result = parseTodayJson(raw);
  const info = getSessionInfo(result.data!);
  if (info.date !== '2026-07-05') throw new Error('Date');
  if (info.questionCount !== 1) throw new Error('Q count');
  if (info.competitorCount !== 1) throw new Error('Comp count');
  if (info.questionTypes[0] !== '信息问答') throw new Error('Type');
  if (info.competitors[0] !== 'Comp1') throw new Error('Comp name');
});

// --- Structural errors ---
test('Missing date field', () => {
  const e = validateTodayJson({ ...validPayload, date: '' });
  if (!e.some((x) => x.field === 'date')) throw new Error('Should flag date');
});

test('Missing questions array', () => {
  const e = validateTodayJson({ date: 'x', competitorMeta: [] });
  if (!e.some((x) => x.field === 'questions')) throw new Error('Should flag questions');
});

test('Empty questions array', () => {
  const e = validateTodayJson({ date: 'x', questions: [], competitorMeta: [] });
  if (!e.some((x) => x.field === 'questions')) throw new Error('Should flag empty');
});

test('Missing aic object', () => {
  const e = validateTodayJson({
    date: 'x',
    questions: [{ questionIndex: 1, question: 'Q', questionType: '信息问答', competitors: [] }],
    competitorMeta: [],
  });
  if (!e.some((x) => x.field.includes('aic'))) throw new Error('Should flag aic');
});

test('Empty competitor name', () => {
  const e = validateTodayJson({
    date: 'x',
    questions: [{
      questionIndex: 1, question: 'Q', questionType: '信息问答',
      aic: { answer: 'A', screenshot: '', evaluation: '' },
      competitors: [{ name: '', answer: 'B', screenshot: '' }],
      competitorEvaluation: '', overallJudgment: '', notes: '',
    }],
    competitorMeta: [],
  });
  if (!e.some((x) => x.field.includes('name') && x.message.includes('empty'))) {
    throw new Error('Should flag empty name');
  }
});

test('Null input', () => {
  const e = validateTodayJson(null);
  if (e.length === 0) throw new Error('Should have errors');
});

test('Array instead of object', () => {
  const e = validateTodayJson([1, 2, 3]);
  if (e.length === 0) throw new Error('Should have errors');
});

test('Invalid JSON file raises error', () => {
  const p = writeJSON('bad.json', '');
  fs.writeFileSync(p, 'not json {{{');
  try {
    loadTodayJson(p);
    throw new Error('Should have thrown');
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (!msg.includes('Invalid JSON')) throw new Error('Wrong error: ' + msg);
  }
});

test('File not found raises error', () => {
  try {
    loadTodayJson('/tmp/nonexistent-abc-999.json');
    throw new Error('Should have thrown');
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (!msg.includes('File not found')) throw new Error('Wrong error: ' + msg);
  }
});

test('Missing competitorMeta', () => {
  const e = validateTodayJson({ ...validPayload, competitorMeta: undefined });
  if (!e.some((x) => x.field === 'competitorMeta')) throw new Error('Should flag');
});

test('Multi-question, multi-competitor', () => {
  const multi = {
    date: '2026-07-05',
    questions: [
      {
        questionIndex: 1, question: 'Q1', questionType: '信息问答' as const,
        aic: { answer: 'A1', screenshot: '', evaluation: '' },
        competitors: [{ name: 'C1', answer: 'B1', screenshot: '' }, { name: 'C2', answer: 'B2', screenshot: '' }],
        competitorEvaluation: '', overallJudgment: '', notes: '',
      },
      {
        questionIndex: 2, question: 'Q2', questionType: '创作生成' as const,
        aic: { answer: 'A2', screenshot: '', evaluation: '' },
        competitors: [{ name: 'C1', answer: 'D1', screenshot: '' }],
        competitorEvaluation: '', overallJudgment: '', notes: '',
      },
    ],
    competitorMeta: [{ name: 'C1', freeCount: 5, model: 'GPT-5' }, { name: 'C2', freeCount: 3, model: 'Gemini' }],
  };
  const p = writeJSON('multi.json', multi);
  const raw = loadTodayJson(p);
  const result = parseTodayJson(raw);
  if (!result.valid) throw new Error('Should be valid: ' + JSON.stringify(result.errors));
  const info = getSessionInfo(result.data!);
  if (info.questionCount !== 2) throw new Error('Q count');
  if (info.competitorCount !== 2) throw new Error('Comp count');
});

test('parseTodayJson — invalid returns null data', () => {
  const result = parseTodayJson({ date: 'x', questions: 'not-array', competitorMeta: [] });
  if (result.valid) throw new Error('Should be invalid');
  if (result.data !== null) throw new Error('Data should be null');
  if (result.errors.length === 0) throw new Error('Should have errors');
});

test('Missing question text', () => {
  const e = validateTodayJson({
    date: 'x',
    questions: [{ questionIndex: 1, question: '', questionType: '信息问答', aic: { answer: 'A', screenshot: '', evaluation: '' }, competitors: [] }],
    competitorMeta: [],
  });
  if (!e.some((x) => x.field.includes('question'))) throw new Error('Should flag empty question text');
});

test('Missing aic.answer', () => {
  const e = validateTodayJson({
    date: 'x',
    questions: [{ questionIndex: 1, question: 'Q', questionType: '信息问答', aic: { screenshot: '', evaluation: '' } as any, competitors: [] }],
    competitorMeta: [],
  });
  if (!e.some((x) => x.field.includes('aic.answer'))) throw new Error('Should flag missing aic.answer');
});

teardown();

// --- Summary ---
console.log(`\n=== ${passed}/${passed + failed} passed ===`);
if (failed > 0) process.exit(1);
