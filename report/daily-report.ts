// ============================================================
// Daily Report Generator
// ============================================================
// Reads AnalysisResult → generates readable Markdown report.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AnalysisResult } from '../analysis/models/analysis-result';

// -----------------------------------------------------------
// Report builder
// -----------------------------------------------------------

function h1(text: string): string { return `# ${text}`; }
function h2(text: string): string { return `## ${text}`; }
function h3(text: string): string { return `### ${text}`; }
function bold(text: string): string { return `**${text}**`; }
function bullet(text: string): string { return `- ${text}`; }
function hr(): string { return '---'; }
function table(headers: string[], rows: string[][]): string {
  const header = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return `${header}\n${sep}\n${body}`;
}

/**
 * Generate a complete Markdown daily report from AnalysisResult.
 */
export function generateDailyReport(result: AnalysisResult): string {
  const { session, questions, summary } = result;
  const lines: string[] = [];

  // Title
  lines.push(h1(`Daily Benchmark Report — ${session.date}`));
  lines.push('');

  // Overview
  lines.push(h2('Overview'));
  lines.push('');
  lines.push(table(
    ['Metric', 'Value'],
    [
      ['Date', session.date],
      ['Questions', String(session.questionCount)],
      ['Competitors', session.competitorNames.join(', ')],
      ['AIC Wins', String(summary.winLossSummary.aicWins)],
      ['Competitor Wins', String(summary.winLossSummary.competitorWins)],
      ['Ties', String(summary.winLossSummary.ties)],
    ],
  ));
  lines.push('');

  // Result distribution
  const total = summary.winLossSummary.aicWins + summary.winLossSummary.competitorWins + summary.winLossSummary.ties;
  if (total > 0) {
    const aicPct = Math.round((summary.winLossSummary.aicWins / total) * 100);
    lines.push(`AIC win rate: ${aicPct}% (${summary.winLossSummary.aicWins}/${total})`);
    lines.push('');
  }

  // Overall assessment
  if (summary.overallAssessment) {
    lines.push(h2('Overall Assessment'));
    lines.push('');
    lines.push(summary.overallAssessment);
    lines.push('');
  }

  // Strengths & Weaknesses
  if (summary.strengths.length > 0 || summary.weaknesses.length > 0) {
    lines.push(h2('Strengths & Weaknesses'));
    lines.push('');
    if (summary.strengths.length > 0) {
      lines.push(bold('Strengths:'));
      for (const s of summary.strengths) lines.push(bullet(s));
      lines.push('');
    }
    if (summary.weaknesses.length > 0) {
      lines.push(bold('Weaknesses:'));
      for (const w of summary.weaknesses) lines.push(bullet(w));
      lines.push('');
    }
  }

  lines.push(hr());
  lines.push('');

  // Per-question details
  lines.push(h2('Question Details'));
  lines.push('');

  for (const q of questions) {
    lines.push(h3(`Q${q.questionIndex}: ${q.question} (${q.questionType})`));
    lines.push('');

    // Judgment
    if (q.judgment) {
      const emoji = q.judgment.result === 'AIC Better' ? '🏆' : q.judgment.result === 'Competitor Better' ? '⚠️' : '🤝';
      lines.push(`${emoji} ${bold('Result:')} ${q.judgment.result} (gap: ${q.judgment.scoreGap > 0 ? '+' : ''}${q.judgment.scoreGap})`);
      lines.push('');
    }

    // Scores table
    if (q.comparison) {
      const headers = ['Answerer', 'Score', ...Object.keys(q.comparison.scoreTable[0]?.dimensions ?? {})];
      const rows = q.comparison.scoreTable.map((e) => [
        e.answererName,
        String(e.totalScore),
        ...Object.values(e.dimensions).map(String),
      ]);
      lines.push(table(headers, rows));
      lines.push('');
    }

    // Comparison summary
    if (q.comparison?.analysisSummary) {
      lines.push(q.comparison.analysisSummary);
      lines.push('');
    }

    // Suggestion
    if (q.suggestion?.required) {
      lines.push(bold('Suggestions:'));
      for (const a of q.suggestion.improvementAreas) lines.push(bullet(a));
      lines.push('');
    }
  }

  lines.push(hr());
  lines.push('');

  // Competitor insights
  if (Object.keys(summary.competitorInsights).length > 0) {
    lines.push(h2('Competitor Insights'));
    lines.push('');
    for (const [name, insight] of Object.entries(summary.competitorInsights)) {
      lines.push(bullet(`${bold(name)}: ${insight}`));
    }
    lines.push('');
  }

  // Recommendations
  if (summary.recommendations.length > 0) {
    lines.push(h2('Top Recommendations'));
    lines.push('');
    for (const r of summary.recommendations) lines.push(bullet(r));
    lines.push('');
  }

  return lines.join('\n');
}

// -----------------------------------------------------------
// File output
// -----------------------------------------------------------

export function saveDailyReport(
  result: AnalysisResult,
  outputDir?: string,
): string {
  const dir = outputDir ?? path.resolve(process.cwd(), 'output');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = `daily_report_${result.session.date}.md`;
  const filepath = path.join(dir, filename);
  const report = generateDailyReport(result);

  fs.writeFileSync(filepath, report, 'utf-8');
  return filepath;
}
