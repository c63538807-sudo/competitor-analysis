// ============================================================
// Fact Check — Claim Verifier
// ============================================================
// Verifies claims using a pluggable ISearchProvider + Judge.
// Default provider: MockSearchProvider (no network calls).

import type { Claim } from './types';
import type { ISearchProvider, SearchResult } from './providers/provider';
import { MockSearchProvider } from './providers/mock-provider';
import { BraveSearchProvider } from './providers/brave-provider';
import { WikipediaProvider } from './providers/wiki-provider';
import { SearchError } from './providers/provider';
import { judgeClaim } from './judge';

// -----------------------------------------------------------
// Auto-detect best provider
// -----------------------------------------------------------

function createDefaultProvider(): ISearchProvider {
  const brave = new BraveSearchProvider();
  if (brave.isConfigured) {
    console.log('[FactCheck] Using Brave Search API');
    return brave;
  }
  console.log('[FactCheck] Using Wikipedia API (free, no key required)');
  return new WikipediaProvider();
}

let defaultProvider: ISearchProvider = createDefaultProvider();

/**
 * Replace the global search provider.
 * Call this once at app startup to switch to a real search API.
 */
export function setSearchProvider(provider: ISearchProvider): void {
  defaultProvider = provider;
}

/**
 * Get the current search provider.
 */
export function getSearchProvider(): ISearchProvider {
  return defaultProvider;
}

// -----------------------------------------------------------
// Verify a single claim
// -----------------------------------------------------------

/**
 * Verify a single claim against the current search provider.
 *
 * Pipeline:
 *   Claim → provider.search(claim) → judgeClaim(claim, results) → updated Claim
 *
 * On provider error: marks claim as unverified with error note.
 */
export async function verifyClaim(claim: Claim): Promise<Claim> {
  try {
    const results: SearchResult[] = await defaultProvider.search(claim);
    return judgeClaim(claim, results);
  } catch (err) {
    if (err instanceof SearchError) {
      return {
        ...claim,
        status: 'unverified',
        evidence: [],
        confidence: 'low',
        note: `搜索服务不可用（${err.providerName}）：${err.message}`,
      };
    }
    return {
      ...claim,
      status: 'unverified',
      evidence: [],
      confidence: 'low',
      note: `验证过程出错：${(err as Error).message}`,
    };
  }
}

// -----------------------------------------------------------
// Verify all claims
// -----------------------------------------------------------

/**
 * Verify all claims using the search provider.
 * Each claim is verified independently.
 */
export async function verifyClaims(claims: Claim[]): Promise<Claim[]> {
  const verified: Claim[] = [];

  for (const claim of claims) {
    const result = await verifyClaim(claim);
    verified.push(result);
  }

  return verified;
}
