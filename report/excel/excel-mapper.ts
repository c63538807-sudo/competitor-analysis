// ============================================================
// Excel Mapper — AnalysisResult → Cell Mapping
// ============================================================
// All field-to-cell mappings are defined HERE.
// Generator functions reference these maps — never hardcode cell positions.

import type { AnalysisResult } from '../../analysis/models/analysis-result';

// -----------------------------------------------------------
// Template 1: AIC Chat效果竞品对比.xlsx
//
// Layout (0-based):
//   Row 0 = header
//   Rows 1-5 = questions 0..4  (row index = questionIndex)
//   Col A=0 日期, B=1 问题类型, C=2 指向功能, D=3 用户问题
//   Col E=4 AIC截图, F=5 AIC表现评价
//   Col G=6 竞品1名称, H=7 竞品1截图
//   Col I=8 竞品2名称, J=9 竞品2截图
//   Col K=10 竞品3名称, L=11 竞品3截图
//   Col M=12 竞品表现评价, N=13 优劣判断, O=14 备注
// -----------------------------------------------------------

export interface Template1Mapping {
  /** Row index for this question (0-based). */
  row: number;
  /** Column → value to write. */
  cells: Record<string, string>;
}

/**
 * Build cell mappings for template 1 from an AnalysisResult.
 * Returns one mapping entry per question.
 */
export function buildTemplate1Mappings(result: AnalysisResult): Template1Mapping[] {
  const mappings: Template1Mapping[] = [];

  for (let i = 0; i < result.questions.length; i++) {
    const qr = result.questions[i];
    // Data starts at row 1 (0-based), questions at rows 1..N
    const row = i + 1;

    // Competitor data
    const comps = result.session.competitorNames;
    const comp0 = comps[0] ?? '';
    const comp1 = comps[1] ?? '';
    const comp2 = comps[2] ?? '';

    // Screenshot fields — use placeholder since we don't embed images in Excel
    const aicScreenshot = '[Screenshot: AIC]';
    const comp0Screenshot = comp0 ? `[Screenshot: ${comp0}]` : '';
    const comp1Screenshot = comp1 ? `[Screenshot: ${comp1}]` : '';
    const comp2Screenshot = comp2 ? `[Screenshot: ${comp2}]` : '';

    // Judgment → Excel verdict
    let judgmentText = '';
    if (qr.judgment) {
      if (qr.judgment.result === 'AIC Better') judgmentText = 'AIC更优';
      else if (qr.judgment.result === 'Competitor Better') judgmentText = '竞品更优';
      else judgmentText = '平局';
    }

    // Notes: only when not AIC Better
    const notes = qr.judgment?.result === 'AIC Better'
      ? ''
      : (qr.suggestion?.summary ?? '');

    // AIC evaluation summary from reviews
    const aicReview = qr.reviews.find((r) => r.answererName === 'AIC');
    const aicEvaluation = aicReview?.shortSummary ?? '';

    // Competitor evaluation — aggregate from comparison summary
    const competitorEvaluation = qr.comparison?.analysisSummary ?? '';

    const cells: Record<string, string> = {};

    cells['A'] = result.session.date;
    cells['B'] = qr.questionType;
    cells['C'] = qr.targetFunction;
    cells['D'] = qr.question;
    cells['E'] = aicScreenshot;
    cells['F'] = aicEvaluation;
    cells['G'] = comp0;
    cells['H'] = comp0Screenshot;
    cells['I'] = comp1;
    cells['J'] = comp1Screenshot;
    cells['K'] = comp2;
    cells['L'] = comp2Screenshot;
    cells['M'] = competitorEvaluation;
    cells['N'] = judgmentText;
    cells['O'] = notes;

    mappings.push({ row, cells });
  }

  return mappings;
}

// -----------------------------------------------------------
// Template 2: 竞品分析具体问答.xlsx
//
// Layout (0-based):
//   Row 0 = header
//   Rows 1-5 = questions 0..4
//   Row 6 = 免费次数
//   Row 7 = 使用模型
//   Col A=0 问题, B=1 问题类型, C=2 AIC回答
//   Col D=3 竞品1回答, E=4 竞品2回答, F=5 竞品3回答
// -----------------------------------------------------------

export interface Template2Mapping {
  /** Row index (0-based). */
  row: number;
  /** Column → value. */
  cells: Record<string, string>;
}

/**
 * Build cell mappings for template 2.
 */
export function buildTemplate2Mappings(result: AnalysisResult): Template2Mapping[] {
  const mappings: Template2Mapping[] = [];

  // Question rows (rows 1..N, 0-based)
  for (let i = 0; i < result.questions.length; i++) {
    const qr = result.questions[i];
    const row = i + 1;

    // Competitors' answers
    const comps = result.session.competitorNames;
    const comp0Answer = qr.reviews.find((r) => r.answererName === comps[0])?.shortSummary
      ?? `[${comps[0]} answer]`;
    const comp1Answer = comps[1]
      ? (qr.reviews.find((r) => r.answererName === comps[1])?.shortSummary ?? `[${comps[1]} answer]`)
      : '';
    const comp2Answer = comps[2]
      ? (qr.reviews.find((r) => r.answererName === comps[2])?.shortSummary ?? `[${comps[2]} answer]`)
      : '';

    // AIC answer — use review summary since original answer text isn't stored in AnalysisResult
    const aicReview = qr.reviews.find((r) => r.answererName === 'AIC');
    const aicAnswer = aicReview?.shortSummary ?? '[AIC answer]';

    const cells: Record<string, string> = {};

    cells['A'] = qr.question;
    cells['B'] = qr.questionType;
    cells['C'] = aicAnswer;
    cells['D'] = comp0Answer;
    cells['E'] = comp1Answer;
    cells['F'] = comp2Answer;

    mappings.push({ row, cells });
  }

  // Free count row (row 7, 0-based = 6)
  {
    const cells: Record<string, string> = {};
    // Col C = AIC → 不填
    const comps = result.session.competitorNames;
    cells['C'] = '不用填';
    if (comps[0]) cells['D'] = String(result.session.competitorMeta.find((m) => m.name === comps[0])?.freeCount ?? '');
    if (comps[1]) cells['E'] = String(result.session.competitorMeta.find((m) => m.name === comps[1])?.freeCount ?? '');
    if (comps[2]) cells['F'] = String(result.session.competitorMeta.find((m) => m.name === comps[2])?.freeCount ?? '');
    mappings.push({ row: 6, cells });
  }

  // Model row (row 8, 0-based = 7)
  {
    const cells: Record<string, string> = {};
    const comps = result.session.competitorNames;
    cells['C'] = '不用填';
    if (comps[0]) cells['D'] = result.session.competitorMeta.find((m) => m.name === comps[0])?.model ?? '';
    if (comps[1]) cells['E'] = result.session.competitorMeta.find((m) => m.name === comps[1])?.model ?? '';
    if (comps[2]) cells['F'] = result.session.competitorMeta.find((m) => m.name === comps[2])?.model ?? '';
    mappings.push({ row: 7, cells });
  }

  return mappings;
}

// -----------------------------------------------------------
// Column letter → index helper
// -----------------------------------------------------------

const COL_MAP: Record<string, number> = {
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8,
  J: 9, K: 10, L: 11, M: 12, N: 13, O: 14, P: 15,
};

/** Convert Excel column letter to 0-based index. */
export function colIndex(letter: string): number {
  const idx = COL_MAP[letter.toUpperCase()];
  if (idx === undefined) throw new Error(`Unknown column: ${letter}`);
  return idx;
}
