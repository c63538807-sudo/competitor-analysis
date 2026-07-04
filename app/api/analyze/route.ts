// ============================================================
// API Route: POST /api/analyze
// ============================================================
// Accepts session data (today.json), runs the full Pipeline,
// returns analysis results + downloadable files.

import { NextResponse } from 'next/server';
import { loadTodayJson, parseTodayJson } from '@/analysis/reader';
import { reviewSession } from '@/analysis/quality-review/review';
import { compareSession } from '@/analysis/comparison/comparison';
import { judgeSession } from '@/analysis/judgment/judgment';
import { suggestSession } from '@/analysis/suggestion/suggestion';
import { factCheckSession } from '@/analysis/fact-check/review';
import { generateSummarySync } from '@/analysis/summary/summarizer';
import { generateDailyReport } from '@/report/daily-report';
import { generateComparisonExcelBuffer, generateQuestionExcelBuffer } from '@/report/excel/excel-generator';

export async function POST(request: Request) {
  try {
    // 1. Parse the incoming session data
    const body = await request.json();
    const raw = JSON.stringify(body);

    // 2. Load and validate
    const data = JSON.parse(raw);
    const parsed = parseTodayJson(data);
    if (!parsed.valid) {
      return NextResponse.json(
        { error: 'Invalid session data', details: parsed.errors },
        { status: 400 },
      );
    }
    const payload = parsed.data!;

    // 3. Run Pipeline
    let result = reviewSession(payload);
    await factCheckSession(result);
    compareSession(result);
    judgeSession(result);
    suggestSession(result);

    // Summary
    result.summary = generateSummarySync(result);

    // 4. Generate outputs
    const analysisJson = JSON.stringify(result, null, 2);
    const dailyReport = generateDailyReport(result);
    const excel1 = generateComparisonExcelBuffer(result);
    const excel2 = generateQuestionExcelBuffer(result);

    // 5. Return everything
    return NextResponse.json({
      success: true,
      date: result.session.date,
      summary: {
        aicWins: result.summary.winLossSummary.aicWins,
        competitorWins: result.summary.winLossSummary.competitorWins,
        ties: result.summary.winLossSummary.ties,
        overall: result.summary.overallAssessment,
      },
      questions: result.questions.map((q) => ({
        index: q.questionIndex,
        question: q.question,
        type: q.questionType,
        verdict: q.judgment?.result ?? 'N/A',
        scores: q.reviews.map((r) => ({
          name: r.answererName,
          score: r.totalScore,
          summary: r.shortSummary,
        })),
      })),
      files: {
        analysisJson: Buffer.from(analysisJson).toString('base64'),
        dailyReport: Buffer.from(dailyReport).toString('base64'),
        excelTemplate1: excel1.toString('base64'),
        excelTemplate2: excel2.toString('base64'),
      },
    });
  } catch (err) {
    console.error('[API] Pipeline failed:', err);
    return NextResponse.json(
      { error: 'Pipeline failed', message: (err as Error).message },
      { status: 500 },
    );
  }
}
