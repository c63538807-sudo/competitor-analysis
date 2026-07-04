// ============================================================
// Fact Check — Brave Search Provider
// ============================================================
// Real web search via Brave Search API.
// Free tier: 2,000 queries/month.
// Register: https://brave.com/search/api/

import type { Claim } from '../types';
import type { ISearchProvider, SearchResult } from './provider';
import { SearchError } from './provider';

// -----------------------------------------------------------
// Brave API types
// -----------------------------------------------------------

interface BraveWebResult {
  title: string;
  url: string;
  description: string;
}

interface BraveAPIResponse {
  web?: {
    results?: BraveWebResult[];
  };
}

// -----------------------------------------------------------
// Provider
// -----------------------------------------------------------

export class BraveSearchProvider implements ISearchProvider {
  readonly name = 'brave';
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.BRAVE_API_KEY ?? '';
  }

  get isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async search(claim: Claim): Promise<SearchResult[]> {
    if (!this.isConfigured) {
      throw new SearchError('BRAVE_API_KEY not set', this.name, false);
    }

    // Build search query from claim text
    const query = buildQuery(claim.text);
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': this.apiKey,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new SearchError(
        `Brave API HTTP ${response.status}`,
        this.name,
        response.status >= 500,
      );
    }

    const data = (await response.json()) as BraveAPIResponse;
    const results = data.web?.results ?? [];

    return results.map((r) => toSearchResult(r, claim.text));
  }
}

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

function buildQuery(claimText: string): string {
  // Use the claim text directly, trimmed to reasonable length
  const cleaned = claimText.replace(/[，。！？、；：""''「」『』【】《》]/g, ' ').trim();
  return cleaned.slice(0, 200);
}

function toSearchResult(r: BraveWebResult, claimText: string): SearchResult {
  const sourceType = classifySourceType(r.url, r.title);
  const direction = determineDirection(r.title, r.description, claimText);

  return {
    title: r.title,
    url: r.url,
    snippet: r.description || r.title,
    sourceType,
    relevance: 'medium',
    direction,
  };
}

function classifySourceType(
  url: string,
  _title: string,
): SearchResult['sourceType'] {
  if (url.includes('.gov') || url.includes('.edu')) return 'official';
  if (url.includes('wikipedia.org') || url.includes('baike.')) return 'encyclopedia';
  if (url.includes('reuters.com') || url.includes('bbc.com') || url.includes('news.')) return 'news';
  if (url.includes('scholar.') || url.includes('arxiv.org')) return 'academic';
  return 'other';
}

function determineDirection(
  title: string,
  snippet: string,
  claimText: string,
): SearchResult['direction'] {
  const combined = (title + ' ' + snippet).toLowerCase();
  const claim = claimText.toLowerCase();

  // Extract key terms from claim
  const keywords = claim
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 10);

  // Count keyword matches
  const matchCount = keywords.filter((kw) => combined.includes(kw)).length;

  // Look for contradiction signals
  const contradicts = /wrong|incorrect|false|myth|debunked|not true|不准确|错误|谣言|假/.test(combined);

  if (contradicts) return 'refuting';
  if (matchCount >= keywords.length * 0.5) return 'supporting';
  if (matchCount >= 2) return 'supporting';
  return 'neutral';
}
