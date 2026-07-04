// ============================================================
// Fact Check — Search Provider Interface
// ============================================================
// All search providers MUST implement this interface.
// The checker module depends ONLY on this interface — never
// on a concrete provider.

import type { Claim } from '../types';

// -----------------------------------------------------------
// Search Result
// -----------------------------------------------------------

export interface SearchResult {
  /** Human-readable source title. */
  title: string;
  /** Source URL. Null for calculation-based results. */
  url: string | null;
  /** Excerpt or summary of the relevant information. */
  snippet: string;
  /** Source classification. */
  sourceType: 'authority' | 'encyclopedia' | 'news' | 'academic' | 'official' | 'calculation' | 'other';
  /** How relevant this result is to the claim. */
  relevance: 'high' | 'medium' | 'low';
  /** Whether this result supports or refutes the claim. */
  direction: 'supporting' | 'refuting' | 'neutral';
}

// -----------------------------------------------------------
// ISearchProvider
// -----------------------------------------------------------

export interface ISearchProvider {
  /** Human-readable provider name (e.g. "mock", "openai", "perplexity"). */
  readonly name: string;

  /**
   * Search for evidence related to a single claim.
   *
   * @returns 0–N search results. Empty array = no relevant info found.
   * @throws SearchError if the provider is unavailable.
   */
  search(claim: Claim): Promise<SearchResult[]>;
}

// -----------------------------------------------------------
// Search Error
// -----------------------------------------------------------

export class SearchError extends Error {
  constructor(
    message: string,
    public readonly providerName: string,
    public readonly retryable: boolean = true,
  ) {
    super(message);
    this.name = 'SearchError';
  }
}
