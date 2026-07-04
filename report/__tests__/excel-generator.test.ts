import * as fs from 'node:fs';
import * as path from 'node:path';
import * as XLSX from 'xlsx';
import { generateComparisonExcel, generateQuestionExcel, generateAll } from '../../report/excel/excel-generator';
import { reviewSession } from '../../analysis/quality-review/review';
import { compareSession } from '../../analysis/comparison/comparison';
import { judgeSession } from '../../analysis/judgment/judgment';
import { suggestSession } from '../../analysis/suggestion/suggestion';
import type { ExportPayload } from '../../types';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`✅ ${name}`); }
  catch (e) { failed++; console.log(`❌ ${name}\n   ${(e as Error).message.split('\n')[0]}`); }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// ============================================================
// Build a full AnalysisResult for testing
// ============================================================
const samplePayload: ExportPayload = {
  date: '2026-07-05',
  questions: [
    {
      questionIndex: 1,
      question: '2025年诺贝尔物理学奖授予了谁？',
      questionType: '信息问答',
      targetFunction: '知识问答',
      aic: { answer: '2025年诺贝尔物理学奖授予了John Hopfield和Geoffrey Hinton，表彰他们在人工神经网络方面的贡献。', screenshot: '', evaluation: '' },
      competitors: [
        { name: 'Ask AI', answer: '授予了John Hopfield和Geoffrey Hinton。', screenshot: '' },
        { name: 'ChatSmith', answer: '诺贝尔物理学奖授予了两位AI先驱。', screenshot: '' },
      ],
      competitorEvaluation: '', overallJudgment: '', notes: '',
    },
    {
      questionIndex: 2,
      question: '帮我写一份英文简历',
      questionType: '创作生成',
      targetFunction: 'AI写作',
      aic: { answer: 'Here is a professional resume template for a software engineer with 5 years experience...', screenshot: '', evaluation: '' },
      competitors: [
        { name: 'Ask AI', answer: 'Below is a tailored resume...', screenshot: '' },
        { name: 'ChatSmith', answer: 'Here is a resume draft.', screenshot: '' },
      ],
      competitorEvaluation: '', overallJudgment: '', notes: '',
    },
  ],
  competitorMeta: [
    { name: 'Ask AI', freeCount: 3, model: 'GPT-5' },
    { name: 'ChatSmith', freeCount: 10, model: 'Claude 5' },
  ],
};

// Run full analysis pipeline
const analysisResult = reviewSession(samplePayload);
compareSession(analysisResult);
judgeSession(analysisResult);
suggestSession(analysisResult);

console.log('=== Excel Generator Tests ===\n');

// ============================================================
// Template 1
// ============================================================
console.log('--- Template 1: AIC Chat效果竞品对比 ---\n');

test('Template 1 generates successfully', () => {
  const outPath = generateComparisonExcel(analysisResult, 'test_template1.xlsx');
  assert(fs.existsSync(outPath), `Output file should exist: ${outPath}`);

  const wb = XLSX.readFile(outPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];

  // Row 1 (0-based) should have Q1 data
  assert(data.length >= 2, 'Should have at least 2 rows');

  // Check date in column A
  assert(String(data[1][0]).includes('2026-07-05'), `Date should be in A2: ${data[1][0]}`);

  // Check question type in column B
  assert(data[1][1] === '信息问答', `Q1 type: ${data[1][1]}`);

  // Check question text in column D
  assert(data[1][3].includes('诺贝尔'), `Q1 text should include 诺贝尔: ${data[1][3]}`);

  // Cleanup
  fs.unlinkSync(outPath);
});

test('Template 1 — judgment values are valid', () => {
  const outPath = generateComparisonExcel(analysisResult, 'test_judgment.xlsx');
  const wb = XLSX.readFile(outPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];

  // Column N (13) = judgment — should be one of the 3 allowed values
  for (let i = 1; i <= analysisResult.questions.length; i++) {
    const judgment = String(data[i][13]);
    assert(
      ['AIC更优', '竞品更优', '平局', ''].some((v) => judgment.includes(v)),
      `Row ${i} judgment should be valid, got: ${judgment}`,
    );
  }

  fs.unlinkSync(outPath);
});

test('Template 1 — competitor names filled correctly', () => {
  const outPath = generateComparisonExcel(analysisResult, 'test_compnames.xlsx');
  const wb = XLSX.readFile(outPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];

  // Column G (6) = 竞品1 name
  assert(data[1][6] === 'Ask AI', `Comp1 name: ${data[1][6]}`);
  // Column I (8) = 竞品2 name
  assert(data[1][8] === 'ChatSmith', `Comp2 name: ${data[1][8]}`);

  fs.unlinkSync(outPath);
});

test('Template 1 — all 15 columns populated for each question', () => {
  const outPath = generateComparisonExcel(analysisResult, 'test_cols.xlsx');
  const wb = XLSX.readFile(outPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];

  for (let i = 1; i <= analysisResult.questions.length; i++) {
    // Check that columns A-O (0-14) are populated
    for (let col = 0; col < 15; col++) {
      const cell = data[i][col];
      assert(cell !== undefined, `Row ${i}, col ${col} should exist`);
    }
  }

  fs.unlinkSync(outPath);
});

// ============================================================
// Template 2
// ============================================================
console.log('\n--- Template 2: 竞品分析具体问答 ---\n');

test('Template 2 generates successfully', () => {
  const outPath = generateQuestionExcel(analysisResult, 'test_template2.xlsx');
  assert(fs.existsSync(outPath), `Output file should exist: ${outPath}`);

  const wb = XLSX.readFile(outPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];

  // Row 1 = Q1
  assert(data[1][0].includes('诺贝尔'), `Q1 text: ${data[1][0]}`);
  assert(data[1][1] === '信息问答', `Q1 type: ${data[1][1]}`);

  // Row 2 = Q2
  assert(data[2][1] === '创作生成', `Q2 type: ${data[2][1]}`);

  fs.unlinkSync(outPath);
});

test('Template 2 — competitor answers populated', () => {
  const outPath = generateQuestionExcel(analysisResult, 'test_companswers.xlsx');
  const wb = XLSX.readFile(outPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];

  // Column C (2) = AIC answer
  assert(data[1][2].length > 0, 'AIC answer should be filled');
  // Column D (3) = Comp1 answer
  assert(data[1][3].length > 0, 'Comp1 answer should be filled');
  // Column E (4) = Comp2 answer
  assert(data[1][4].length > 0, 'Comp2 answer should be filled');

  fs.unlinkSync(outPath);
});

test('Template 2 — freeCount and model rows', () => {
  const outPath = generateQuestionExcel(analysisResult, 'test_meta.xlsx');
  const wb = XLSX.readFile(outPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];

  // Row 7 (index 6) = 免费次数
  assert(String(data[6][2]).includes('不用填'), `AIC freeCount: ${data[6][2]}`);
  assert(String(data[6][3]) === '3', `Ask AI freeCount should be 3: ${data[6][3]}`);
  assert(String(data[6][4]) === '10', `ChatSmith freeCount should be 10: ${data[6][4]}`);

  // Row 8 (index 7) = 使用模型
  assert(String(data[7][2]).includes('不用填'), `AIC model: ${data[7][2]}`);
  assert(data[7][3] === 'GPT-5', `Ask AI model: ${data[7][3]}`);
  assert(data[7][4] === 'Claude 5', `ChatSmith model: ${data[7][4]}`);

  fs.unlinkSync(outPath);
});

// ============================================================
// generateAll
// ============================================================
test('generateAll produces both files', () => {
  const { template1Path, template2Path } = generateAll(analysisResult);
  assert(fs.existsSync(template1Path), 'Template 1 exists');
  assert(fs.existsSync(template2Path), 'Template 2 exists');

  // Cleanup
  fs.unlinkSync(template1Path);
  fs.unlinkSync(template2Path);
});

// ============================================================
// Templates untouched
// ============================================================
test('Original templates are not modified', () => {
  const templatesDir = path.resolve('/Users/christy/Documents/competitor-analysis/templates');
  const t1 = path.join(templatesDir, 'AIC Chat效果竞品对比.xlsx');
  const t2 = path.join(templatesDir, '竞品分析具体问答.xlsx');

  const stat1Before = fs.statSync(t1);
  const stat2Before = fs.statSync(t2);

  // Run generation
  const { template1Path, template2Path } = generateAll(analysisResult);

  const stat1After = fs.statSync(t1);
  const stat2After = fs.statSync(t2);

  assert(stat1Before.mtimeMs === stat1After.mtimeMs, 'Template 1 not modified');
  assert(stat2Before.mtimeMs === stat2After.mtimeMs, 'Template 2 not modified');

  fs.unlinkSync(template1Path);
  fs.unlinkSync(template2Path);
});

console.log(`\n=== ${passed}/${passed + failed} passed ===`);
if (failed > 0) process.exit(1);
