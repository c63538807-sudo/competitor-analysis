// ============================================================
// Pipeline Orchestrator
// ============================================================
// Wires Collector output → Analysis → Report into a single
// automated pipeline.
//
// Usage:
//   npx tsx pipeline/pipeline.ts output/today.json

import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadTodayJson, parseTodayJson } from '../analysis/reader';
import { reviewSession } from '../analysis/quality-review/review';
import { compareSession } from '../analysis/comparison/comparison';
import { judgeSession } from '../analysis/judgment/judgment';
import { suggestSession } from '../analysis/suggestion/suggestion';
import { factCheckSession } from '../analysis/fact-check/review';
import { generateSummarySync } from '../analysis/summary/summarizer';
import { generateAll } from '../report/excel/excel-generator';
import { saveDailyReport } from '../report/daily-report';
import type { AnalysisResult } from '../analysis/models/analysis-result';

// -----------------------------------------------------------
// Step logger
// -----------------------------------------------------------

let stepCounter = 0;

function log(message: string): void {
  stepCounter++;
  console.log(`[${stepCounter}] ${message}`);
}

function error(message: string): never {
  console.error(`\n✗ Pipeline FAILED at step ${stepCounter}:`);
  console.error(`  ${message}`);
  process.exit(1);
}

// -----------------------------------------------------------
// Simple Summary (placeholder until Summary Agent is built)
// -----------------------------------------------------------

function fillSummary(result: AnalysisResult): void {
  result.summary = generateSummarySync(result);
}

// -----------------------------------------------------------
// Pipeline runner
// -----------------------------------------------------------

export interface PipelineResult {
  analysisResult: AnalysisResult;
  analysisJsonPath: string;
  template1Path: string;
  template2Path: string;
}

/**
 * Run the full Collector → Analysis → Report pipeline.
 *
 * Steps:
 *   1. Read today.json
 *   2. Quality Review
 *   3. Comparison
 *   4. Judgment
 *   5. Suggestion
 *   6. Summary (simple stats)
 *   7. Save analysis_result.json
 *   8. Generate Excel reports
 */
export async function runPipeline(todayJsonPath: string): Promise<PipelineResult> {
  console.log('=== Pipeline Started ===\n');

  // --- Step 1: Read ---
  log('Reader — loading today.json');
  let raw: unknown;
  try {
    raw = loadTodayJson(todayJsonPath);
  } catch (err) {
    error(`Failed to load today.json: ${(err as Error).message}`);
  }
  const parsed = parseTodayJson(raw);
  if (!parsed.valid) {
    error(`Invalid today.json: ${parsed.errors.map((e) => `${e.field}: ${e.message}`).join('; ')}`);
  }
  const payload = parsed.data!;
  console.log(`   ✓ ${payload.questions.length} questions, ${payload.competitorMeta.length} competitors`);

  // --- Step 2: Quality Review ---
  log('Quality Review — scoring all answers');
  const result = reviewSession(payload);
  const totalReviews = result.questions.reduce((sum, q) => sum + q.reviews.length, 0);
  console.log(`   ✓ ${totalReviews} answers scored`);

  // --- Step 3: Fact Check ---
  log('Fact Check — verifying claims');
  await factCheckSession(result);
  const fcClaims = result.questions.reduce((sum, q) => sum + (q.factCheck?.claims.length ?? 0), 0);
  console.log(`   ✓ ${fcClaims} claims checked`);

  // --- Step 5: Comparison ---
  log('Comparison — comparing per question');
  compareSession(result);
  const withComparison = result.questions.filter((q) => q.comparison).length;
  console.log(`   ✓ ${withComparison}/${result.questions.length} questions compared`);

  // --- Step 6: Judgment ---
  log('Judgment — determining winners');
  judgeSession(result);
  const judged = result.questions.filter((q) => q.judgment).length;
  console.log(`   ✓ ${judged}/${result.questions.length} questions judged`);

  // --- Step 7: Suggestion ---
  log('Suggestion — generating improvement advice');
  suggestSession(result);
  const withSuggestions = result.questions.filter((q) => q.suggestion?.required).length;
  console.log(`   ✓ ${withSuggestions} suggestions generated`);

  // --- Step 8: Summary ---
  log('Summary — generating daily overview');
  fillSummary(result);
  console.log(`   ✓ Summary: ${result.summary.winLossSummary.aicWins}W / ${result.summary.winLossSummary.competitorWins}L / ${result.summary.winLossSummary.ties}T`);

  // --- Step 9: Save analysis_result.json ---
  log('Save — writing analysis_result.json');
  const outputDir = path.resolve(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const jsonPath = path.join(outputDir, `analysis_result_${result.session.date}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf-8');
  // Also copy to public/ so the web app can fetch it
  const publicDir = path.resolve(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'analysis_result.json'), JSON.stringify(result, null, 2), 'utf-8');
  console.log(`   ✓ ${jsonPath} (also copied to public/)`);

  // --- Step 10: Excel ---
  log('Excel Generator — producing reports');
  const { template1Path, template2Path } = generateAll(result);
  console.log(`   ✓ ${template1Path}`);
  console.log(`   ✓ ${template2Path}`);

  // --- Step 11: Daily Report ---
  log('Daily Report — generating Markdown report');
  const reportPath = saveDailyReport(result);
  console.log(`   ✓ ${reportPath}`);

  console.log('\n=== Pipeline Finished ===');
  console.log('Generated:');
  console.log(`  - ${jsonPath}`);
  console.log(`  - ${template1Path}`);
  console.log(`  - ${template2Path}`);
  console.log(`  - ${reportPath}`);

  return {
    analysisResult: result,
    analysisJsonPath: jsonPath,
    template1Path,
    template2Path,
  };
}

// -----------------------------------------------------------
// CLI entry
// -----------------------------------------------------------

const filePath = process.argv[2];
if (filePath) {
  runPipeline(filePath).catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
