// ============================================================
// Analysis Engine — Entry Point
// ============================================================
// Sprint 1: JSON Reader only.
// Future sprints will add pipeline steps here.

import { loadTodayJson, parseTodayJson } from './reader';
import type { ExportPayload } from '../types';

export interface SessionInfo {
  date: string;
  questionCount: number;
  competitorCount: number;
  questionTypes: string[];
  competitors: string[];
}

/**
 * Extract a human-readable summary from a parsed today.json.
 */
export function getSessionInfo(payload: ExportPayload): SessionInfo {
  const competitorNames = new Set<string>();
  for (const q of payload.questions) {
    for (const c of q.competitors) {
      competitorNames.add(c.name);
    }
  }

  return {
    date: payload.date,
    questionCount: payload.questions.length,
    competitorCount: competitorNames.size,
    questionTypes: payload.questions.map((q) => q.questionType),
    competitors: Array.from(competitorNames),
  };
}

/**
 * Main entry point: load → validate → parse → print session info.
 *
 * Usage:
 *   npx tsx analysis/index.ts path/to/today.json
 */
export async function main(filePath: string): Promise<void> {
  console.log('=== Analysis Engine ===\n');

  // Step 1: Load
  console.log(`[1/3] Loading: ${filePath}`);
  let raw: unknown;
  try {
    raw = loadTodayJson(filePath);
    console.log('  ✓ File loaded and parsed as JSON');
  } catch (err) {
    console.error('  ✗ Load failed:', (err as Error).message);
    process.exit(1);
  }

  // Step 2: Validate + Parse
  console.log('[2/3] Validating structure...');
  const result = parseTodayJson(raw);

  if (!result.valid) {
    console.error('  ✗ Validation failed:');
    for (const err of result.errors) {
      console.error(`    - ${err.field}: ${err.message}`);
    }
    process.exit(1);
  }
  console.log(`  ✓ Structure valid (${result.errors.length} issues)`);

  // Step 3: Print session info
  console.log('[3/3] Session info:');
  const info = getSessionInfo(result.data!);
  console.log(`  Date:             ${info.date}`);
  console.log(`  Questions:        ${info.questionCount}`);
  console.log(`  Competitors:      ${info.competitorCount} (${info.competitors.join(', ')})`);
  console.log(`  Question Types:   ${info.questionTypes.join(', ')}`);

  console.log('\n=== Reader complete ===');
  console.log('Session loaded successfully. Ready for analysis pipeline.');
}

// CLI entry
const filePath = process.argv[2];
if (filePath) {
  main(filePath).catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
