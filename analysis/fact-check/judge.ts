// ============================================================
// Fact Check — Evidence Judge
// ============================================================
// Determines Claim verification status based on SearchResult[].

import type { Claim, Evidence } from './types';
import type { SearchResult } from './providers/provider';

// -----------------------------------------------------------
// Convert SearchResult → Evidence
// -----------------------------------------------------------

function toEvidence(sr: SearchResult): Evidence {
  return {
    url: sr.url,
    title: sr.title,
    type: sr.sourceType,
    direction: sr.direction,
    excerpt: sr.snippet,
  };
}

// -----------------------------------------------------------
// Judge a single claim against search results
// -----------------------------------------------------------

/**
 * Evaluate search results and update the claim's status, evidence,
 * confidence, and note.
 */
export function judgeClaim(claim: Claim, results: SearchResult[]): Claim {
  const evidence = results.map(toEvidence);
  const supporting = results.filter((r) => r.direction === 'supporting');
  const refuting = results.filter((r) => r.direction === 'refuting');
  const highRelevance = results.filter((r) => r.relevance === 'high');

  // No results → unverifiable
  if (results.length === 0) {
    return {
      ...claim,
      status: 'unverifiable',
      evidence: [],
      confidence: 'low',
      note: '未找到相关来源，无法验证此主张。',
    };
  }

  // Refuted: at least one high-relevance refuting result
  if (refuting.length > 0 && highRelevance.some((r) => r.direction === 'refuting')) {
    return {
      ...claim,
      status: 'refuted',
      evidence,
      confidence: 'high',
      note: `发现 ${refuting.length} 条反驳证据，该主张不成立。`,
    };
  }

  // Verified: ≥2 high-relevance supporting, no refuting
  if (highRelevance.filter((r) => r.direction === 'supporting').length >= 2 && refuting.length === 0) {
    return {
      ...claim,
      status: 'verified',
      evidence,
      confidence: 'high',
      note: `${supporting.length} 条权威来源支持此主张。`,
    };
  }

  // Partially correct: some supporting, some refuting
  if (supporting.length > 0 && refuting.length > 0) {
    return {
      ...claim,
      status: 'partially-correct',
      evidence,
      confidence: 'medium',
      note: `既有支持（${supporting.length}条）也有反驳（${refuting.length}条），信息部分正确。`,
    };
  }

  // Weak verification: 1 supporting source, no refuting
  if (supporting.length >= 1 && refuting.length === 0) {
    return {
      ...claim,
      status: 'verified',
      evidence,
      confidence: 'medium',
      note: `找到 ${supporting.length} 条支持来源，但来源数量较少。`,
    };
  }

  // Default: unverified
  return {
    ...claim,
    status: 'unverified',
    evidence,
    confidence: 'low',
    note: '证据不足以做出明确判断。',
  };
}

/**
 * Judge all claims against their respective search results.
 */
export function judgeClaims(
  claims: Claim[],
  resultsMap: Map<string, SearchResult[]>,
): Claim[] {
  return claims.map((claim) => {
    const results = resultsMap.get(claim.id) ?? [];
    return judgeClaim(claim, results);
  });
}
