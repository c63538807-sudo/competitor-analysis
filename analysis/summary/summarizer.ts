// ============================================================
// Summary Agent — Daily Report Generation
// ============================================================
// Reads a complete AnalysisResult and generates a structured
// daily summary. Uses LLM when available, falls back to
// rule-based statistics.

import type { AnalysisResult, AnalysisSummary } from '../models/analysis-result';

// -----------------------------------------------------------
// Rule-based summary (fallback)
// -----------------------------------------------------------

function ruleBasedSummary(result: AnalysisResult): AnalysisSummary {
  const judgments = result.questions.map((q) => q.judgment).filter(Boolean);
  let aicWins = 0, competitorWins = 0, ties = 0;
  for (const j of judgments) {
    if (j!.result === 'AIC Better') aicWins++;
    else if (j!.result === 'Competitor Better') competitorWins++;
    else ties++;
  }

  const allStrengths = new Set<string>();
  const allWeaknesses = new Set<string>();
  const allRecs: string[] = [];

  for (const q of result.questions) {
    const aic = q.reviews.find((r) => r.answererName === 'AIC');
    if (aic) { for (const s of aic.strengths) allStrengths.add(s); }
    if (q.suggestion?.required) {
      for (const a of q.suggestion.improvementAreas) allWeaknesses.add(a);
      allRecs.push(...q.suggestion.actionItems);
    }
  }

  const topRecs = [...new Set(allRecs)].slice(0, 3);

  return {
    overallAssessment: `${result.questions.length} 题中 AIC ${aicWins} 胜 ${competitorWins} 负 ${ties} 平。`,
    strengths: Array.from(allStrengths).slice(0, 3),
    weaknesses: Array.from(allWeaknesses).slice(0, 3),
    competitorInsights: {},
    winLossSummary: { aicWins, competitorWins, ties, details: '' },
    recommendations: topRecs,
  };
}

// -----------------------------------------------------------
// LLM summary
// -----------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert AI product analyst generating a daily benchmark summary.

Based on the full analysis data provided, generate a structured summary in Chinese.

Rules:
- overallAssessment: 100-200 characters, objective, mention key findings
- strengths: 2-3 AIC strengths across all questions (each 5-15 chars)
- weaknesses: 2-3 AIC weaknesses (each 5-15 chars)
- competitorInsights: for each competitor, 1 sentence about their performance
- recommendations: top 3 optimization suggestions (each 10-30 chars)

Return ONLY valid JSON in this exact format:
{
  "overallAssessment": "...",
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "competitorInsights": { "CompName": "..." },
  "recommendations": ["...", "...", "..."]
}`;

function buildSummaryPrompt(result: AnalysisResult): string {
  const parts: string[] = [
    `## Date: ${result.session.date}`,
    `## Questions: ${result.session.questionCount}, Competitors: ${result.session.competitorNames.join(', ')}`,
  ];

  // Judgment summary
  const judgments = result.questions.map((q) => q.judgment).filter(Boolean);
  let aicW = 0, compW = 0, t = 0;
  for (const j of judgments) {
    if (j!.result === 'AIC Better') aicW++;
    else if (j!.result === 'Competitor Better') compW++;
    else t++;
  }
  parts.push(`## Results: AIC Better=${aicW}, Competitor Better=${compW}, Tie=${t}`);

  // Per-question details
  for (const q of result.questions) {
    const j = q.judgment;
    const comp = q.comparison;
    parts.push([
      `### Q${q.questionIndex}: ${q.question} (${q.questionType})`,
      `  Verdict: ${j?.result ?? 'N/A'}, Gap: ${j?.scoreGap ?? 'N/A'}`,
      `  AIC score: ${comp?.scoreTable.find((r) => r.answererName === 'AIC')?.totalScore ?? 'N/A'}`,
      q.suggestion?.required ? `  Suggestions: ${q.suggestion.summary}` : '',
    ].join('\n'));
  }

  parts.push('## Instructions\nGenerate the daily summary JSON.');
  return parts.join('\n\n');
}

async function llmSummary(result: AnalysisResult): Promise<AnalysisSummary> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return ruleBasedSummary(result);

  const baseUrl = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.LLM_MODEL || 'gpt-4o';

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildSummaryPrompt(result) },
        ],
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as Record<string, unknown>;
    const content = (data.choices as Array<{ message?: { content?: string } }>)?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim());

    const base = ruleBasedSummary(result);
    return {
      overallAssessment: (parsed.overallAssessment as string) || base.overallAssessment,
      strengths: (Array.isArray(parsed.strengths) ? parsed.strengths : base.strengths) as string[],
      weaknesses: (Array.isArray(parsed.weaknesses) ? parsed.weaknesses : base.weaknesses) as string[],
      competitorInsights: (parsed.competitorInsights as Record<string, string>) ?? {},
      winLossSummary: base.winLossSummary,
      recommendations: (Array.isArray(parsed.recommendations) ? parsed.recommendations : base.recommendations) as string[],
    };
  } catch (err) {
    console.warn(`[Summary] LLM failed: ${(err as Error).message}, using rule-based`);
    return ruleBasedSummary(result);
  }
}

// -----------------------------------------------------------
// Public API
// -----------------------------------------------------------

/**
 * Generate a daily summary from a complete AnalysisResult.
 * Uses LLM when API key is available, otherwise rule-based.
 */
export async function generateSummary(result: AnalysisResult): Promise<AnalysisSummary> {
  return llmSummary(result);
}

/**
 * Synchronous rule-based summary (guaranteed no network).
 */
export function generateSummarySync(result: AnalysisResult): AnalysisSummary {
  return ruleBasedSummary(result);
}
