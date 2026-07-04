// ============================================================
// Excel Generator — produces the two standard Excel reports
// ============================================================
// Reads AnalysisResult, maps fields via excel-mapper,
// writes via excel-writer. NEVER modifies original templates.

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as XLSX from 'xlsx';
import { copyTemplate, getFirstSheet, setCell, saveWorkbook } from './excel-writer';
import {
  buildTemplate1Mappings,
  buildTemplate2Mappings,
  colIndex,
} from './excel-mapper';
import type { AnalysisResult } from '../../analysis/models/analysis-result';

// -----------------------------------------------------------
// Paths
// -----------------------------------------------------------

function getRoot(): string {
  if (process.env.COLLECTOR_ROOT) return process.env.COLLECTOR_ROOT;
  return path.resolve(process.cwd());
}

function getTemplatesDir(): string {
  return path.join(getRoot(), 'templates');
}

function getOutputDir(): string {
  return path.join(getRoot(), 'output');
}

function resolveTemplate(name: string): string {
  // Try multiple locations
  const candidates = [
    path.join(getRoot(), 'public', name),                   // public/ (Next.js static)
    path.join(getRoot(), 'templates', name),                // templates/ (dev)
    path.join(path.resolve('.', 'public'), name),            // relative public/
    path.join(path.resolve('.', 'templates'), name),         // relative templates/
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  // Fall back to first candidate
  return candidates[0];
}

function getTemplate1Path(): string {
  return resolveTemplate('AIC Chat效果竞品对比.xlsx');
}

function getTemplate2Path(): string {
  return resolveTemplate('竞品分析具体问答.xlsx');
}

// -----------------------------------------------------------
// generateComparisonExcel (Template 1)
// -----------------------------------------------------------

/**
 * Generate AIC Chat效果竞品对比.xlsx from an AnalysisResult.
 * Writes to output/ and returns the output path.
 */
export function generateComparisonExcel(
  result: AnalysisResult,
  outputFilename?: string,
): string {
  const wb = copyTemplate(getTemplate1Path());
  const ws = getFirstSheet(wb);

  const mappings = buildTemplate1Mappings(result);

  for (const mapping of mappings) {
    for (const [colLetter, value] of Object.entries(mapping.cells)) {
      setCell(ws, colIndex(colLetter), mapping.row, value);
    }
  }

  const filename = outputFilename ?? `AIC_Chat效果竞品对比_${result.session.date}.xlsx`;
  const outputPath = path.join(getOutputDir(), filename);
  saveWorkbook(wb, outputPath);

  return outputPath;
}

// -----------------------------------------------------------
// generateQuestionExcel (Template 2)
// -----------------------------------------------------------

/**
 * Generate 竞品分析具体问答.xlsx from an AnalysisResult.
 * Writes to output/ and returns the output path.
 */
export function generateQuestionExcel(
  result: AnalysisResult,
  outputFilename?: string,
): string {
  const wb = copyTemplate(getTemplate2Path());
  const ws = getFirstSheet(wb);

  const mappings = buildTemplate2Mappings(result);

  for (const mapping of mappings) {
    for (const [colLetter, value] of Object.entries(mapping.cells)) {
      setCell(ws, colIndex(colLetter), mapping.row, value);
    }
  }

  const filename = outputFilename ?? `竞品分析具体问答_${result.session.date}.xlsx`;
  const outputPath = path.join(getOutputDir(), filename);
  saveWorkbook(wb, outputPath);

  return outputPath;
}

// -----------------------------------------------------------
// generateAll
// -----------------------------------------------------------

export interface GenerateResult {
  template1Path: string;
  template2Path: string;
}

/**
 * Generate both Excel reports.
 */
export function generateAll(result: AnalysisResult): GenerateResult {
  const template1Path = generateComparisonExcel(result);
  const template2Path = generateQuestionExcel(result);

  return { template1Path, template2Path };
}

// -----------------------------------------------------------
// In-memory buffer versions (for API routes)
// -----------------------------------------------------------

function generateToBuffer(
  result: AnalysisResult,
  templatePath: string,
  buildMappings: (r: AnalysisResult) => { row: number; cells: Record<string, string> }[],
): Buffer {
  const wb = copyTemplate(templatePath);
  const ws = getFirstSheet(wb);
  for (const mapping of buildMappings(result)) {
    for (const [colLetter, value] of Object.entries(mapping.cells)) {
      setCell(ws, colIndex(colLetter), mapping.row, value);
    }
  }
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as ArrayBuffer);
}

export function generateComparisonExcelBuffer(result: AnalysisResult): Buffer {
  return generateToBuffer(result, getTemplate1Path(), buildTemplate1Mappings);
}

export function generateQuestionExcelBuffer(result: AnalysisResult): Buffer {
  return generateToBuffer(result, getTemplate2Path(), buildTemplate2Mappings);
}
