import { extractClaims } from '../../analysis/fact-check/extractor';
import { factCheckQuestion, factCheckSession, determineFCTrigger } from '../../analysis/fact-check/review';
import { MockSearchProvider } from '../../analysis/fact-check/providers/mock-provider';
import { setSearchProvider, getSearchProvider } from '../../analysis/fact-check/checker';
import { judgeClaim } from '../../analysis/fact-check/judge';
import { verifyClaim } from '../../analysis/fact-check/checker';
import { createEmptyResult } from '../../analysis/models/analysis-result';
import type { Claim } from '../../analysis/fact-check/types';
import type { ISearchProvider, SearchResult } from '../../analysis/fact-check/providers/provider';

// Reset to mock provider before each test area
const mockProvider = new MockSearchProvider();
setSearchProvider(mockProvider);

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  // Wrap in async handler
  const run = async () => {
    try { await fn(); passed++; console.log(`✅ ${name}`); }
    catch (e) { failed++; console.log(`❌ ${name}\n   ${(e as Error).message.split('\n')[0]}`); }
  };
  // Tests run sequentially via async main()
  testQueue.push({ name, run });
}

const testQueue: { name: string; run: () => Promise<void> }[] = [];

function makeReview(name: string, score: number, summary?: string) {
  const dims: Record<string, { score: number; comment: string }> = {
    completeness: { score: 3, comment: '' }, professionalism: { score: 3, comment: '' },
    structure: { score: 3, comment: '' }, practicality: { score: 3, comment: '' },
    naturalness: { score: 3, comment: '' }, interaction: { score: 0, comment: '不适用' },
  };
  return { answererName: name, totalScore: score, dimensions: dims as any, strengths: [], weaknesses: [], shortSummary: summary ?? `${name} answer` };
}

// ============================================================
// extractClaims (Sprint 2 regression)
// ============================================================
test('extractClaims: year detection', () => {
  const claims = extractClaims('Q?', '信息问答', '诺贝尔奖于1901年首次颁发。', 'AIC');
  if (claims.length === 0) throw new Error('No claims');
});

test('extractClaims: 创作生成 → 0', () => {
  const claims = extractClaims('Q?', '创作生成', 'The sun rises in 2025.', 'AIC');
  if (claims.length !== 0) throw new Error('Should be 0');
});

// ============================================================
// Judge
// ============================================================
test('judge: empty results → unverifiable', () => {
  const claim: Claim = { id: 'c1', text: 'Something happened', sourceAnswerer: 'AIC', status: 'pending', evidence: [], confidence: 'low', note: '' };
  const result = judgeClaim(claim, []);
  if (result.status !== 'unverifiable') throw new Error(`Expected unverifiable, got ${result.status}`);
  if (result.evidence.length !== 0) throw new Error('Evidence should be empty');
});

test('judge: 2 supporting → verified high', () => {
  const results: SearchResult[] = [
    { title: 'S1', url: 'https://a.com', snippet: 'Supports', sourceType: 'official', relevance: 'high', direction: 'supporting' },
    { title: 'S2', url: 'https://b.com', snippet: 'Supports too', sourceType: 'encyclopedia', relevance: 'high', direction: 'supporting' },
  ];
  const claim: Claim = { id: 'c1', text: 'Fact', sourceAnswerer: 'AIC', status: 'pending', evidence: [], confidence: 'low', note: '' };
  const result = judgeClaim(claim, results);
  if (result.status !== 'verified') throw new Error(`Expected verified, got ${result.status}`);
  if (result.confidence !== 'high') throw new Error(`Expected high, got ${result.confidence}`);
});

test('judge: refuting + high relevance → refuted', () => {
  const results: SearchResult[] = [
    { title: 'S1', url: 'https://a.com', snippet: 'Wrong', sourceType: 'official', relevance: 'high', direction: 'refuting' },
  ];
  const claim: Claim = { id: 'c1', text: 'Wrong fact', sourceAnswerer: 'AIC', status: 'pending', evidence: [], confidence: 'low', note: '' };
  const result = judgeClaim(claim, results);
  if (result.status !== 'refuted') throw new Error(`Expected refuted, got ${result.status}`);
});

test('judge: mixed → partially-correct', () => {
  const results: SearchResult[] = [
    { title: 'S1', url: 'https://a.com', snippet: 'Yes', sourceType: 'news', relevance: 'medium', direction: 'supporting' },
    { title: 'S2', url: 'https://b.com', snippet: 'No', sourceType: 'news', relevance: 'medium', direction: 'refuting' },
  ];
  const claim: Claim = { id: 'c1', text: 'Debatable', sourceAnswerer: 'AIC', status: 'pending', evidence: [], confidence: 'low', note: '' };
  const result = judgeClaim(claim, results);
  if (result.status !== 'partially-correct') throw new Error(`Expected partially-correct, got ${result.status}`);
});

// ============================================================
// Mock Provider
// ============================================================
test('mock provider: known facts → results', async () => {
  const claim: Claim = { id: 'c1', text: '2025 Nobel Prize Hopfield Hinton', sourceAnswerer: 'AIC', status: 'pending', evidence: [], confidence: 'low', note: '' };
  const results = await mockProvider.search(claim);
  if (results.length < 2) throw new Error(`Expected ≥2 results, got ${results.length}`);
  if (results[0].direction !== 'supporting') throw new Error('Should be supporting');
});

test('mock provider: unknown → empty', async () => {
  const claim: Claim = { id: 'c2', text: 'Some random fact no one knows about', sourceAnswerer: 'AIC', status: 'pending', evidence: [], confidence: 'low', note: '' };
  const results = await mockProvider.search(claim);
  if (results.length !== 0) throw new Error(`Expected 0, got ${results.length}`);
});

test('mock provider: refuted claim → refuting results', async () => {
  const claim: Claim = { id: 'c3', text: 'Einstein developed the theory of evolution', sourceAnswerer: 'AIC', status: 'pending', evidence: [], confidence: 'low', note: '' };
  const results = await mockProvider.search(claim);
  if (results.length === 0) throw new Error('Should have results');
  if (results[0].direction !== 'refuting') throw new Error(`Should be refuting, got ${results[0].direction}`);
});

// ============================================================
// verifyClaim (checker)
// ============================================================
test('verifyClaim: verified through mock provider', async () => {
  const claim: Claim = { id: 'c1', text: '2025 Nobel Prize Hopfield Hinton won for neural networks', sourceAnswerer: 'AIC', status: 'pending', evidence: [], confidence: 'low', note: '' };
  const result = await verifyClaim(claim);
  if (result.status !== 'verified') throw new Error(`Expected verified, got ${result.status}`);
  if (result.evidence.length < 2) throw new Error(`Evidence should be populated, got ${result.evidence.length}`);
  if (result.evidence[0].title.length === 0) throw new Error('Evidence title should not be empty');
});

test('verifyClaim: unverifiable for unknown claim', async () => {
  const claim: Claim = { id: 'c2', text: 'Unknown obscure factoid', sourceAnswerer: 'AIC', status: 'pending', evidence: [], confidence: 'low', note: '' };
  const result = await verifyClaim(claim);
  if (result.status !== 'unverifiable') throw new Error(`Expected unverifiable, got ${result.status}`);
});

test('verifyClaim: handles provider error gracefully', async () => {
  const failingProvider = new MockSearchProvider();
  failingProvider.failNext();
  setSearchProvider(failingProvider);

  const claim: Claim = { id: 'c3', text: 'Some claim', sourceAnswerer: 'AIC', status: 'pending', evidence: [], confidence: 'low', note: '' };
  const result = await verifyClaim(claim);

  // Restore mock
  setSearchProvider(mockProvider);

  if (result.status !== 'unverified') throw new Error(`Expected unverified, got ${result.status}`);
  if (!result.note.includes('Mock')) throw new Error('Note should mention provider failure');
});

// ============================================================
// factCheckQuestion (async integration)
// ============================================================
test('factCheckQuestion: full pipeline — extract + verify', async () => {
  const result = await factCheckQuestion(
    'Who won the 2025 Nobel Prize in Physics?',
    '信息问答',
    'John Hopfield and Geoffrey Hinton won the 2025 Nobel Prize in Physics for neural networks.',
    [{ name: 'BotA', answer: 'Hopfield won in 2025 for work on neural networks at 清华大学.' }],
  );
  if (result.claims.length === 0) throw new Error('Should have claims');
  // Check that some claims are verified
  const verifiedCount = result.claims.filter((c) => c.status === 'verified').length;
  if (verifiedCount === 0) throw new Error('Should have at least 1 verified claim');

  if (result.checkedAt === null) throw new Error('checkedAt should be set');
  // Confidence may vary based on provider results — just check it's valid
  if (!['high', 'medium', 'low'].includes(result.confidence)) throw new Error('Invalid confidence');
});

test('factCheckQuestion: skip type returns 不适用', async () => {
  const result = await factCheckQuestion('Write a poem', '创作生成', 'Roses are red.', []);
  if (result.required !== 'skip') throw new Error('Should skip');
  if (result.result !== '不适用') throw new Error('Should be 不适用');
  if (result.claims.length !== 0) throw new Error('No claims');
});

test('factCheckQuestion: refuted claim detected', async () => {
  const result = await factCheckQuestion(
    'What did Einstein win?',
    '信息问答',
    'Einstein won the Nobel Prize in Mathematics.',
    [],
  );
  // The mock provider has a refutation pattern for "Nobel Math"
  const refutedCount = result.claims.filter((c) => c.status === 'refuted').length;
  if (refutedCount === 0) throw new Error('Should detect refuted claim about Nobel Math');
});

// ============================================================
// evidence structure
// ============================================================
test('verified claim has populated evidence', async () => {
  const claim: Claim = { id: 'c1', text: '2025 Nobel Prize Hopfield Hinton', sourceAnswerer: 'AIC', status: 'pending', evidence: [], confidence: 'low', note: '' };
  const result = await verifyClaim(claim);
  if (result.evidence.length === 0) throw new Error('Should have evidence');
  const ev = result.evidence[0];
  if (!ev.url) throw new Error('Evidence should have url');
  if (!ev.title) throw new Error('Evidence should have title');
  if (!['supporting', 'refuting', 'neutral'].includes(ev.direction)) throw new Error('Invalid direction');
});

// ============================================================
// factCheckSession (async integration)
// ============================================================
test('factCheckSession: fills all questions', async () => {
  const result = createEmptyResult(
    '2026-07-05',
    [
      { questionIndex: 1, question: 'Q1: Nobel?', questionType: '信息问答', targetFunction: '' },
      { questionIndex: 2, question: 'Q2: Write poem', questionType: '创作生成', targetFunction: '' },
    ],
    ['AIC', 'BotA'],
    [{ name: 'BotA', freeCount: 5, model: 'GPT-5' }],
  );

  result.questions[0].reviews = [
    makeReview('AIC', 85, 'Hopfield won the 2025 Nobel Prize in Physics.'),
    makeReview('BotA', 72, 'Hopfield founded neural network field in 1982.'),
  ];
  result.questions[1].reviews = [
    makeReview('AIC', 80, 'A poem about spring.'),
    makeReview('BotA', 78, 'Another poem.'),
  ];

  const updated = await factCheckSession(result);

  // Q1: 信息问答 → should have claims
  if (updated.questions[0].factCheck!.claims.length === 0) throw new Error('Q1 should have claims');
  if (updated.questions[0].factCheck!.required !== 'mandatory') throw new Error('Q1 mandatory');

  // Q2: 创作生成 → skip
  if (updated.questions[1].factCheck!.required !== 'skip') throw new Error('Q2 skip');
});

// ============================================================
// Provider replaceability
// ============================================================
test('setSearchProvider changes active provider', () => {
  const original = getSearchProvider();
  const custom: ISearchProvider = {
    name: 'custom-test',
    search: async () => [],
  };
  setSearchProvider(custom);
  const current = getSearchProvider();
  setSearchProvider(original); // restore

  if (current.name !== 'custom-test') throw new Error('Provider not changed');
});

// ============================================================
// Determine FC trigger
// ============================================================
test('determineFCTrigger: all types', () => {
  if (determineFCTrigger('信息问答', 'text') !== 'mandatory') throw new Error('信息问答');
  if (determineFCTrigger('创作生成', 'text') !== 'skip') throw new Error('创作生成');
  if (determineFCTrigger('工具类', 'text') !== 'partial') throw new Error('工具类');
  if (determineFCTrigger('推理分析', 'text') !== 'partial') throw new Error('推理分析');
  if (determineFCTrigger('信息问答', '') !== 'skip') throw new Error('empty');
});

console.log('=== Fact Check Sprint 3 ===\n');

// Run all tests sequentially
async function main() {
  for (const { name, run } of testQueue) {
    await run();
  }
  console.log(`\n=== ${passed}/${passed + failed} passed ===`);
  if (failed > 0) process.exit(1);
}
main();
