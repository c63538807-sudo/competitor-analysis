import * as fs from 'node:fs';
import * as path from 'node:path';
import { runPipeline } from '../../pipeline/pipeline';
import type { PipelineResult } from '../../pipeline/pipeline';

async function main() {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try { fn(); passed++; console.log(`✅ ${name}`); }
    catch (e) { failed++; console.log(`❌ ${name}\n   ${(e as Error).message.split('\n')[0]}`); }
  }

  function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg);
  }

  const todayJsonPath = path.resolve('/Users/christy/Documents/competitor-analysis/output/today.json');

  console.log('=== Pipeline Integration Tests ===\n');
  console.log('Running pipeline...');
  const pipelineResult: PipelineResult = await runPipeline(todayJsonPath);
  console.log('Pipeline complete.\n');

  // --- Tests ---
  test('Pipeline returns AnalysisResult', () => {
    assert(pipelineResult.analysisResult !== null, 'AnalysisResult should exist');
    assert(pipelineResult.analysisResult.questions.length > 0, 'Should have questions');
  });

  test('analysis_result.json exists and is valid JSON', () => {
    assert(fs.existsSync(pipelineResult.analysisJsonPath), 'JSON file should exist');
    const raw = fs.readFileSync(pipelineResult.analysisJsonPath, 'utf-8');
    const parsed = JSON.parse(raw);
    assert(parsed.session.date.length > 0, 'Date present');
    assert(parsed.questions.length > 0, 'Questions present');
    assert(parsed.summary !== undefined, 'Summary present');
  });

  test('Template 1 Excel exists', () => {
    assert(fs.existsSync(pipelineResult.template1Path), 'Template 1 should exist');
  });

  test('Template 2 Excel exists', () => {
    assert(fs.existsSync(pipelineResult.template2Path), 'Template 2 should exist');
  });

  test('All pipeline steps filled', () => {
    const r = pipelineResult.analysisResult;
    for (const qr of r.questions) {
      assert(qr.reviews.length > 0, `Q${qr.questionIndex}: reviews`);
      assert(qr.comparison !== null, `Q${qr.questionIndex}: comparison`);
      assert(qr.judgment !== null, `Q${qr.questionIndex}: judgment`);
      assert(qr.suggestion !== null, `Q${qr.questionIndex}: suggestion`);
      assert(qr.factCheck !== null, `Q${qr.questionIndex}: factCheck`);
    }
  });

  test('Summary has valid stats', () => {
    const s = pipelineResult.analysisResult.summary;
    assert(typeof s.winLossSummary.aicWins === 'number', 'aicWins');
    assert(typeof s.winLossSummary.competitorWins === 'number', 'competitorWins');
    assert(typeof s.winLossSummary.ties === 'number', 'ties');
    assert(s.overallAssessment.length > 0, 'overallAssessment');
  });

  test('JSON round-trip preserves structure', () => {
    const raw = fs.readFileSync(pipelineResult.analysisJsonPath, 'utf-8');
    const parsed = JSON.parse(raw);
    for (const q of parsed.questions) {
      assert(Array.isArray(q.reviews), 'reviews array');
      assert('comparison' in q, 'comparison key');
      assert('judgment' in q, 'judgment key');
      assert('suggestion' in q, 'suggestion key');
      assert(q.factCheck !== null, 'factCheck is now populated (Sprint 3)');
    }
  });

  console.log(`\n=== ${passed}/${passed + failed} passed ===`);
  if (failed > 0) process.exit(1);
}

main();
