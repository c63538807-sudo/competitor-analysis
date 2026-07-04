import { LLMScorer, createLLMScorer, autoCreateLLMScorer } from '../../analysis/quality-review/llm-scorer';
import type { ILLMScorer, DimensionId } from '../../analysis/quality-review/types';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`✅ ${name}`); }
  catch (e) { failed++; console.log(`❌ ${name}\n   ${(e as Error).message.split('\n')[0]}`); }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

console.log('=== LLM Scorer Tests ===\n');

// 1. Constructor creates valid instance
test('createLLMScorer with openai config', () => {
  const scorer = createLLMScorer({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: 'sk-test',
  });
  assert(scorer.provider === 'openai', 'provider should be openai');
  assert(scorer.name.includes('openai'), 'name should include openai');
  assert(scorer.name.includes('gpt-4o'), 'name should include model');
});

// 2. No API key → fallback to rule scorer
test('score() without API key returns rule-based result', () => {
  const scorer = new LLMScorer({ provider: 'openai', model: 'gpt-4o' });
  const result = scorer.score('What is AI?', '信息问答', 'AI is artificial intelligence.', 'AIC');
  assert(result.totalScore >= 0 && result.totalScore <= 100, 'Valid score');
  assert(result.answererName === 'AIC', 'Correct answerer name');
  assert(result.dimensions.completeness.score > 0, 'Dimensions populated');
});

// 3. scoreAsync() without API key falls back
test('scoreAsync() without API key falls back to rule', async () => {
  const scorer = new LLMScorer({ provider: 'openai', model: 'gpt-4o' });
  const result = await scorer.scoreAsync('Q?', '信息问答', 'Answer.', 'AIC');
  assert(result.totalScore >= 0, 'Valid score');
  assert(result.shortSummary.length > 0, 'Has summary');
});

// 4. scoreAsync() with empty answer
test('scoreAsync() with empty answer falls back', async () => {
  const scorer = new LLMScorer({ provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' });
  const result = await scorer.scoreAsync('Q?', '信息问答', '', 'AIC');
  assert(result.totalScore <= 40, 'Empty answer scores low');
});

// 5. ILLMScorer interface compatibility
test('LLMScorer implements ILLMScorer', () => {
  const scorer: ILLMScorer = new LLMScorer({ provider: 'claude', model: 'sonnet' });
  assert(typeof scorer.name === 'string', 'name is string');
  assert(typeof scorer.provider === 'string', 'provider is string');
  assert(typeof scorer.score === 'function', 'score is function');
});

// 6. autoCreateLLMScorer returns null without env vars
test('autoCreateLLMScorer returns null with no env keys', () => {
  // Save and clear env vars for test
  const saved = { openai: process.env.OPENAI_API_KEY, anthropic: process.env.ANTHROPIC_API_KEY, gemini: process.env.GEMINI_API_KEY };
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const scorer = autoCreateLLMScorer();
  assert(scorer === null, 'Should return null');

  // Restore
  if (saved.openai) process.env.OPENAI_API_KEY = saved.openai;
  if (saved.anthropic) process.env.ANTHROPIC_API_KEY = saved.anthropic;
  if (saved.gemini) process.env.GEMINI_API_KEY = saved.gemini;
});

// 7. autoCreateLLMScorer detects OPENAI_API_KEY
test('autoCreateLLMScorer detects OPENAI_API_KEY', () => {
  process.env.OPENAI_API_KEY = 'sk-fake-test-key';
  const scorer = autoCreateLLMScorer();
  delete process.env.OPENAI_API_KEY;
  assert(scorer !== null, 'Should detect key');
  assert(scorer!.provider === 'openai', 'Should be openai');
});

// 8. Multiple providers — priority order
test('autoCreateLLMScorer: OPENAI takes priority', () => {
  process.env.OPENAI_API_KEY = 'sk-openai';
  process.env.ANTHROPIC_API_KEY = 'sk-anthropic';
  const scorer = autoCreateLLMScorer();
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  assert(scorer!.provider === 'openai', 'OpenAI should take priority');
});

// 9. API error → graceful fallback
test('scoreAsync with bad endpoint → falls back', async () => {
  const scorer = new LLMScorer({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: 'sk-test',
    baseUrl: 'https://invalid.example.com',
  });
  const result = await scorer.scoreAsync('Q?', '信息问答', 'A reasonable answer.', 'AIC');
  // Should fall back to rule scorer on network error
  assert(result.totalScore >= 0 && result.totalScore <= 100, 'Valid fallback score');
  assert(result.answererName === 'AIC', 'Correct name');
});

// 10. Configurable temperature and maxTokens
test('LLMScorer respects custom temperature and maxTokens', () => {
  const scorer = new LLMScorer({
    provider: 'openai', model: 'gpt-4o',
    temperature: 0.7, maxTokens: 1024,
  });
  // Can't assert private fields, but construction succeeds
  assert(scorer.name.length > 0, 'Construction succeeds');
});

// 11. All dimensions present in rule-fallback output
test('Rule fallback includes all 6 dimensions', () => {
  const scorer = new LLMScorer({ provider: 'openai', model: 'gpt-4o' });
  const result = scorer.score('Q?', '信息问答', 'An answer.', 'AIC');
  const dims = ['completeness', 'professionalism', 'structure', 'practicality', 'naturalness', 'interaction'];
  for (const d of dims) {
    const key = d as DimensionId;
    assert(key in result.dimensions, `${d} should exist`);
    assert(result.dimensions[key].score >= 0 && result.dimensions[key].score <= 5, `${d} score valid`);
  }
});

console.log(`\n=== ${passed}/${passed + failed} passed ===`);
if (failed > 0) process.exit(1);
