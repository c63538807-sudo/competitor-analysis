// ============================================================
// Fact Check — Claim Extractor (Rule-based, Sprint 2)
// ============================================================
// Extracts verifiable claims from answer text using pattern
// matching. No LLM, no NLP, no Web Search.

import type { Claim } from './types';

// -----------------------------------------------------------
// Pattern definitions
// -----------------------------------------------------------

interface PatternDef {
  name: string;
  regex: RegExp;
  confidence: 'high' | 'medium' | 'low';
  note: string;
}

const PATTERNS: PatternDef[] = [
  // --- Years (Chinese — no \b, Chinese chars are \w in JS) ---
  {
    name: 'year',
    regex: /(?:公元|公元前)?(1[0-9]{3}|20[0-9]{2})\s*年(?:\s*代)?/g,
    confidence: 'high',
    note: '年份信息',
  },
  {
    name: 'year-en',
    regex: /\b(in|since|before|after|around)\s+(1[0-9]{3}|20[0-9]{2})\b/gi,
    confidence: 'high',
    note: '年份信息（英文）',
  },

  // --- Dates ---
  {
    name: 'date-cn',
    regex: /\d{1,2}月\d{1,2}日/g,
    confidence: 'high',
    note: '具体日期',
  },
  {
    name: 'date-en',
    regex: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?\b/gi,
    confidence: 'high',
    note: '具体日期（英文）',
  },

  // --- Percentages ---
  {
    name: 'percentage',
    regex: /\d{1,3}(?:\.\d{1,2})?\s*%/g,
    confidence: 'high',
    note: '百分比数据',
  },
  {
    name: 'percentage-cn',
    regex: /百分之\d{1,3}(?:\.\d{1,2})?/g,
    confidence: 'high',
    note: '百分比数据',
  },

  // --- Amounts / Quantities ---
  {
    name: 'amount',
    regex: /\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:亿|万|千|百)?\s*(?:元|美元|欧元|英镑|日元|人民币|次|人|名|位|个|家|所|份|篇|条|项)/g,
    confidence: 'high',
    note: '数量/金额信息',
  },

  // --- Person names in context ---
  {
    name: 'person-cn',
    regex: /(?:授予|颁发|获奖|得主|获奖者|获奖人|主席|总统|总理|部长|教授|博士|院士|导演|作者|创始人|CEO)[：:\s]*([一-龥]{2,4})(?:[，。,.\s]|$)/g,
    confidence: 'high',
    note: '人物名称',
  },

  // --- Locations ---
  {
    name: 'location-cn',
    regex: /[一-龥]{2,6}(?:市|省|区|县|镇|国|岛|洲|半岛|山脉|河流|湖泊)/g,
    confidence: 'high',
    note: '地理位置',
  },

  // --- Organizations ---
  {
    name: 'organization-cn',
    regex: /[一-龥]{2,12}(?:大学|学院|研究所|研究院|公司|集团|组织|委员会|协会|学会|部门|机构|中心|基金会|联盟)/g,
    confidence: 'high',
    note: '组织机构',
  },

  // --- Factual sentences ---
  {
    name: 'fact-is',
    regex: /([^。！？.!?\n]{8,80}(?:是|为|即|指|属于|位于|处于)[^。！？.!?\n]{4,80})/g,
    confidence: 'medium',
    note: '定义/归属陈述',
  },
  {
    name: 'fact-won',
    regex: /([^。！？.!?\n]{5,60}(?:获得|赢得|夺得|荣获|授予|获颁|获奖)[^。！？.!?\n]{5,60})/g,
    confidence: 'high',
    note: '获奖/荣誉陈述',
  },
  {
    name: 'fact-founded',
    regex: /([^。！？.!?\n]{5,60}(?:成立于|创立于|建立于|始建于|创办于|发布|推出|发表|宣布)[^。！？.!?\n]{5,60})/g,
    confidence: 'high',
    note: '成立/发布陈述',
  },

  // --- Specific number contexts ---
  {
    name: 'specific-number',
    regex: /(?:约|大约|超过|低于|达到|共计|共|总计|多达)\s*\d{1,5}(?:\.\d+)?\s*(?:亿|万|千|百)?\s*(?:元|美元|人|次|个|家|所|份|篇|条|项|%|％)/g,
    confidence: 'high',
    note: '具体数值信息',
  },
];

// -----------------------------------------------------------
// Sentence splitter
// -----------------------------------------------------------

function splitSentences(text: string): string[] {
  return text
    .split(/[。！？.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);
}

// -----------------------------------------------------------
// Claim extraction
// -----------------------------------------------------------

function normalizeClaim(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Find matches for a single pattern in the given text.
 * Each unique match becomes one Claim.
 */
function findPatternClaims(
  text: string,
  answererName: string,
  pattern: PatternDef,
  existingTexts: Set<string>,
): Claim[] {
  const claims: Claim[] = [];
  // Reset regex state
  const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // For patterns with capture groups, use the full match or first group
    const raw = match[1] ?? match[0];
    const cleaned = normalizeClaim(raw);

    // Skip if too short or already extracted
    if (cleaned.length < 2) continue;
    if (existingTexts.has(cleaned)) continue;

    existingTexts.add(cleaned);

    claims.push({
      id: '', // Will be assigned by caller
      text: cleaned,
      sourceAnswerer: answererName,
      status: 'pending',
      evidence: [],
      confidence: pattern.confidence,
      note: pattern.note,
    });
  }

  return claims;
}

/**
 * Extract standalone factual sentences that don't match specific patterns,
 * but contain factual keywords.
 */
function findFactualSentences(
  text: string,
  answererName: string,
  existingTexts: Set<string>,
): Claim[] {
  const claims: Claim[] = [];
  const sentences = splitSentences(text);

  const factualKeywords = [
    '成立于', '创立于', '建立于', '位于', '处于',
    '获得', '赢得', '夺得', '荣获', '获奖',
    '发布', '推出', '发表', '宣布',
    '发现', '发明', '证明', '证实',
    '增长', '下降', '达到', '超过',
    '被评为', '当选', '任命',
    '根据', '据', '数据显示', '统计',
    '授予', '颁发', '获奖者',
    // English
    'won', 'awarded', 'founded', 'established', 'published',
    'released', 'announced', 'discovered', 'proved', 'developed',
    'elected', 'appointed', 'according to', 'based on',
  ];

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const hasKeyword = factualKeywords.some((kw) => lower.includes(kw.toLowerCase()));
    if (!hasKeyword) continue;

    const cleaned = normalizeClaim(sentence);
    if (cleaned.length < 6) continue;
    if (existingTexts.has(cleaned)) continue;

    existingTexts.add(cleaned);

    claims.push({
      id: '',
      text: cleaned,
      sourceAnswerer: answererName,
      status: 'pending',
      evidence: [],
      confidence: 'medium',
      note: '事实性陈述',
    });
  }

  return claims;
}

// -----------------------------------------------------------
// Public API
// -----------------------------------------------------------

/**
 * Extract verifiable claims from a single answer.
 *
 * Uses rule-based pattern matching to find:
 *  - Years, dates, percentages, amounts
 *  - Person names, locations, organizations
 *  - Factual assertions (is/won/founded/released/etc.)
 *
 * No LLM. No NLP. No Web Search.
 */
export function extractClaims(
  _questionText: string,
  questionType: string,
  answerText: string,
  answererName: string,
): Claim[] {
  // Creation-type questions have no verifiable claims
  if (questionType === '创作生成') {
    return [];
  }

  if (!answerText || answerText.trim().length === 0) {
    return [];
  }

  const allClaims: Claim[] = [];
  const seen = new Set<string>();

  // Scan each pattern
  for (const pattern of PATTERNS) {
    const found = findPatternClaims(answerText, answererName, pattern, seen);
    allClaims.push(...found);
  }

  // Add factual sentences not caught by specific patterns
  const factual = findFactualSentences(answerText, answererName, seen);
  allClaims.push(...factual);

  // Assign IDs
  return allClaims.map((c, i) => ({
    ...c,
    id: `claim-${i + 1}`,
  }));
}
