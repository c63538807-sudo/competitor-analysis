// ============================================================
// Excel Writer — low-level template read/write
// ============================================================
// Reads a template .xlsx, fills cells, saves to output.
// NEVER modifies the original template file.

import * as XLSX from 'xlsx';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Load a template workbook. The original file is never modified.
 */
export function loadTemplate(templatePath: string): XLSX.WorkBook {
  const resolved = path.resolve(templatePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Template not found: ${resolved}`);
  }
  // Read as buffer first to avoid path encoding issues in bundled server
  const buf = fs.readFileSync(resolved);
  return XLSX.read(buf, { type: 'buffer' });
}

/**
 * Fill a single cell. Creates the cell reference if it doesn't exist.
 */
export function setCell(
  ws: XLSX.WorkSheet,
  col: number, // 0-based
  row: number, // 0-based
  value: string | number,
): void {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  ws[addr] = { t: typeof value === 'number' ? 'n' : 's', v: value };
}

/**
 * Write a workbook to disk.
 */
export function saveWorkbook(wb: XLSX.WorkBook, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  XLSX.writeFile(wb, outputPath);
}

/**
 * Get the first sheet name from a workbook.
 */
export function getFirstSheet(wb: XLSX.WorkBook): XLSX.WorkSheet {
  const name = wb.SheetNames[0];
  return wb.Sheets[name];
}

/**
 * Create a fresh workbook copy from a template that can be modified.
 * The original template file is not touched.
 */
export function copyTemplate(templatePath: string): XLSX.WorkBook {
  return loadTemplate(templatePath);
}
