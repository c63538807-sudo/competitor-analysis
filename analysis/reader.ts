// ============================================================
// Analysis Engine — JSON Reader (Sprint 1)
// ============================================================
// Reads and validates today.json exported by Collector.
// Does NOT perform any analysis.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ExportPayload } from '../types';

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

export interface ValidationError {
  field: string;
  message: string;
}

export interface ParseResult {
  valid: boolean;
  errors: ValidationError[];
  data: ExportPayload | null;
}

// -----------------------------------------------------------
// Load
// -----------------------------------------------------------

/**
 * Read and JSON-parse a today.json file from disk.
 * Returns raw parsed JSON — no validation yet.
 */
export function loadTodayJson(filePath: string): unknown {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }

  const raw = fs.readFileSync(resolved, 'utf-8');

  try {
    return JSON.parse(raw);
  } catch (err) {
    const message = err instanceof SyntaxError ? err.message : String(err);
    throw new Error(`Invalid JSON in ${resolved}: ${message}`);
  }
}

// -----------------------------------------------------------
// Validate
// -----------------------------------------------------------

/**
 * Validate that a parsed JSON object conforms to the today.json schema.
 * Returns a list of structural issues. Empty list = valid.
 */
export function validateTodayJson(data: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (data === null || data === undefined) {
    errors.push({ field: 'root', message: 'Data is null or undefined' });
    return errors;
  }

  if (typeof data !== 'object' || Array.isArray(data)) {
    errors.push({ field: 'root', message: 'Expected a JSON object, got ' + typeof data });
    return errors;
  }

  const obj = data as Record<string, unknown>;

  // --- date ---
  if (typeof obj.date !== 'string' || obj.date.length === 0) {
    errors.push({ field: 'date', message: 'Missing or empty date field' });
  }

  // --- questions ---
  if (!Array.isArray(obj.questions)) {
    errors.push({ field: 'questions', message: 'Missing or not an array' });
  } else if (obj.questions.length === 0) {
    errors.push({ field: 'questions', message: 'Questions array is empty' });
  } else {
    // Validate each question
    (obj.questions as unknown[]).forEach((q, i) => {
      if (typeof q !== 'object' || q === null) {
        errors.push({ field: `questions[${i}]`, message: 'Not an object' });
        return;
      }
      const question = q as Record<string, unknown>;

      if (typeof question.questionIndex !== 'number') {
        errors.push({ field: `questions[${i}].questionIndex`, message: 'Missing or not a number' });
      }
      if (typeof question.question !== 'string' || question.question.length === 0) {
        errors.push({ field: `questions[${i}].question`, message: 'Missing or empty' });
      }
      if (typeof question.questionType !== 'string' || question.questionType.length === 0) {
        errors.push({ field: `questions[${i}].questionType`, message: 'Missing or empty' });
      }

      // --- aic ---
      if (typeof question.aic !== 'object' || question.aic === null) {
        errors.push({ field: `questions[${i}].aic`, message: 'Missing or not an object' });
      } else {
        const aic = question.aic as Record<string, unknown>;
        if (typeof aic.answer !== 'string') {
          errors.push({ field: `questions[${i}].aic.answer`, message: 'Missing or not a string' });
        }
      }

      // --- competitors ---
      if (!Array.isArray(question.competitors)) {
        errors.push({ field: `questions[${i}].competitors`, message: 'Missing or not an array' });
      } else {
        (question.competitors as unknown[]).forEach((comp, ci) => {
          if (typeof comp !== 'object' || comp === null) {
            errors.push({ field: `questions[${i}].competitors[${ci}]`, message: 'Not an object' });
            return;
          }
          const c = comp as Record<string, unknown>;
          if (typeof c.name !== 'string' || c.name.length === 0) {
            errors.push({ field: `questions[${i}].competitors[${ci}].name`, message: 'Missing or empty' });
          }
          if (typeof c.answer !== 'string') {
            errors.push({ field: `questions[${i}].competitors[${ci}].answer`, message: 'Missing or not a string' });
          }
        });
      }
    });
  }

  // --- competitorMeta ---
  if (!Array.isArray(obj.competitorMeta)) {
    errors.push({ field: 'competitorMeta', message: 'Missing or not an array' });
  }

  return errors;
}

// -----------------------------------------------------------
// Parse
// -----------------------------------------------------------

/**
 * Validate + type-cast parsed JSON into an ExportPayload.
 * Returns { valid, errors, data }.
 *
 * When `valid` is false, `data` is null.
 * When `valid` is true,  `data` contains the fully-typed ExportPayload.
 */
export function parseTodayJson(data: unknown): ParseResult {
  const errors = validateTodayJson(data);

  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }

  return { valid: true, errors: [], data: data as ExportPayload };
}
