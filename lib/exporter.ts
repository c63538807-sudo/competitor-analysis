// ============================================================
// Export Engine
// ============================================================
// Reads Session from store → validates completeness →
// generates a standards-compliant today.json ExportPayload.
//
// Pages MUST go through this module. NEVER hand-roll JSON export.

import type { Session, ExportPayload, ExportQuestion, ExportCompetitorAnswer, ExportCompetitorMeta } from '@/types';

// ============================================================
// Validation
// ============================================================

export interface ValidationIssue {
  /** Human-readable description of what's missing. */
  message: string;
  /** Which competitor this issue relates to (if applicable). */
  competitor?: string;
  /** Which question this issue relates to (if applicable). */
  questionLabel?: string;
}

export interface ValidationResult {
  /** True when the session is complete and ready to export. */
  valid: boolean;
  /** List of every issue found. Empty when valid. */
  issues: ValidationIssue[];
}

/**
 * Run all completeness checks against a Session.
 * Returns a structured result that the Export page can render as a checklist.
 */
export function validateSession(session: Session): ValidationResult {
  const issues: ValidationIssue[] = [];
  const { questions, competitors, answers, screenshots, metadata } = session;

  // --- 1. Questions must exist ---
  if (questions.length === 0) {
    issues.push({ message: 'No questions imported. Import questions first.' });
    // No point continuing — every other check depends on questions.
    return { valid: false, issues };
  }

  // --- 2. Competitors must exist ---
  if (competitors.length === 0) {
    issues.push({ message: 'No competitors selected. Select competitors first.' });
    return { valid: false, issues };
  }

  // --- 3 & 4. Every competitor × every question must have answer + screenshot ---
  for (const competitor of competitors) {
    for (const question of questions) {
      const label = `Q${question.id.replace('q', '')}`;

      // Answer check
      if (!answers[competitor]?.[question.id]?.trim()) {
        issues.push({
          message: `Answer is missing`,
          competitor,
          questionLabel: label,
        });
      }

      // Screenshot check
      if (!screenshots[competitor]?.[question.id]) {
        issues.push({
          message: `Screenshot is missing`,
          competitor,
          questionLabel: label,
        });
      }
    }
  }

  // --- 5. Metadata for non-AIC competitors ---
  for (const competitor of competitors) {
    // AIC metadata is never collected (per project spec).
    if (competitor === 'AIC') continue;

    const meta = metadata[competitor];

    if (!meta?.modelUsed?.trim()) {
      issues.push({ message: 'Model used is not filled in', competitor });
    }

    if (!meta?.freeCount?.trim()) {
      issues.push({ message: 'Free count is not filled in', competitor });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

// ============================================================
// Transformation: Session → ExportPayload
// ============================================================

/**
 * Build a standards-compliant ExportPayload from a Session.
 *
 * Mapping:
 *  - questions[].aic        ← answers/screenshots for competitor named "AIC"
 *  - questions[].competitors ← answers/screenshots for all other competitors
 *  - competitorMeta          ← metadata for non-AIC competitors
 *  - Analysis fields (evaluation, overallJudgment, notes) ← empty (Collector scope)
 *
 * Assumes the session has already passed validateSession().
 */
export function buildExportPayload(session: Session): ExportPayload {
  const { date, questions, competitors, answers, screenshots, metadata } = session;

  // Split competitors: "AIC" is special, everything else goes into competitors[]
  const aicName = 'AIC';
  const otherCompetitors = competitors.filter((c) => c !== aicName);

  const exportQuestions: ExportQuestion[] = questions.map((question, index) => {
    // AIC data for this question
    const aicAnswer = answers[aicName]?.[question.id] ?? '';
    const aicScreenshot = screenshots[aicName]?.[question.id] ?? '';

    // Other competitors for this question
    const competitorAnswers: ExportCompetitorAnswer[] = otherCompetitors.map((name) => ({
      name,
      answer: answers[name]?.[question.id] ?? '',
      screenshot: screenshots[name]?.[question.id] ?? '',
    }));

    return {
      questionIndex: index + 1, // 1-based per data_model.md
      question: question.prompt,
      questionType: question.type,
      targetFunction: question.targetFunction ?? '',
      aic: {
        answer: aicAnswer,
        screenshot: aicScreenshot,
        evaluation: '', // Collector does not analyze — filled by Analysis module
      },
      competitors: competitorAnswers,
      competitorEvaluation: '', // Analysis module fills this
      overallJudgment: '', // Analysis module fills this
      notes: '', // Analysis module fills this
    };
  });

  // Competitor metadata (non-AIC only)
  const competitorMeta: ExportCompetitorMeta[] = otherCompetitors.map((name) => {
    const meta = metadata[name];
    return {
      name,
      freeCount: parseInt(meta?.freeCount ?? '0', 10) || 0,
      model: meta?.modelUsed ?? '',
    };
  });

  return {
    date,
    questions: exportQuestions,
    competitorMeta,
  };
}

// ============================================================
// Download helper
// ============================================================

/**
 * Trigger a browser file download of the given JSON payload.
 * Uses a temporary anchor element that is never appended to the React-managed DOM.
 */
export function downloadJSON(payload: ExportPayload, filename = 'today.json'): void {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  // Use click() directly — modern browsers support downloading without
  // appending the anchor to the DOM. If that fails, fall back to appending.
  try {
    anchor.click();
  } catch {
    // Fallback for older browsers: append → click → remove
    const parent = document.body || document.documentElement;
    parent.appendChild(anchor);
    anchor.click();
    if (anchor.parentNode === parent) {
      parent.removeChild(anchor);
    }
  }

  setTimeout(() => URL.revokeObjectURL(url), 100);
}
