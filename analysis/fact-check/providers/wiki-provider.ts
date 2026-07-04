// ============================================================
// Fact Check — Wikipedia Search Provider
// ============================================================
// Free, no API key, no registration.
// Uses Wikipedia REST API for fact verification.

import type { Claim } from '../types';
import type { ISearchProvider, SearchResult } from './provider';
import { SearchError } from './provider';

// -----------------------------------------------------------
// Wikipedia API types
// -----------------------------------------------------------

interface WikiPage {
  pageid: number;
  title: string;
  extract: string;
  fullurl: string;
}

interface WikiSearchResult {
  query?: {
    search?: { pageid: number; title: string; snippet: string }[];
  };
}

interface WikiExtractResult {
  query?: {
    pages?: Record<string, WikiPage>;
  };
}

// -----------------------------------------------------------
// Provider
// -----------------------------------------------------------

export class WikipediaProvider implements ISearchProvider {
  readonly name = 'wikipedia';
  private lang: string;

  constructor(lang: 'en' | 'zh' = 'en') {
    this.lang = lang;
  }

  async search(claim: Claim): Promise<SearchResult[]> {
    const base = `https://${this.lang}.wikipedia.org/w/api.php`;

    try {
      // Step 1: Search for relevant pages
      const query = buildQuery(claim.text);
      const searchUrl = `${base}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&origin=*`;

      const searchResp = await fetch(searchUrl, {
        signal: AbortSignal.timeout(15_000),
      });

      if (!searchResp.ok) {
        throw new SearchError(`Wikipedia HTTP ${searchResp.status}`, this.name, true);
      }

      const searchData = (await searchResp.json()) as WikiSearchResult;
      const pages = searchData.query?.search ?? [];

      if (pages.length === 0) {
        return [];
      }

      // Step 2: Get extracts for top pages
      const pageIds = pages.map((p) => p.pageid).join('|');
      const extractUrl = `${base}?action=query&pageids=${pageIds}&prop=extracts|info&exintro=1&explaintext=1&inprop=url&format=json&origin=*`;

      const extractResp = await fetch(extractUrl, {
        signal: AbortSignal.timeout(15_000),
      });

      if (!extractResp.ok) {
        throw new SearchError(`Wikipedia extract HTTP ${extractResp.status}`, this.name, true);
      }

      const extractData = (await extractResp.json()) as WikiExtractResult;
      const pageData = extractData.query?.pages ?? {};

      return Object.values(pageData).map((page) => ({
        title: page.title,
        url: page.fullurl || `https://${this.lang}.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
        snippet: page.extract?.slice(0, 300) || '',
        sourceType: 'encyclopedia',
        relevance: 'high',
        direction: determineDirection(page.extract || '', claim.text),
      }));
    } catch (err) {
      if (err instanceof SearchError) throw err;
      throw new SearchError(
        `Wikipedia search failed: ${(err as Error).message}`,
        this.name,
        true,
      );
    }
  }
}

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

function buildQuery(claimText: string): string {
  return claimText
    .replace(/[，。！？、；：""''「」『』【】《》（）()\n]/g, ' ')
    .trim()
    .slice(0, 200);
}

function determineDirection(
  text: string,
  claimText: string,
): SearchResult['direction'] {
  const combined = text.toLowerCase();
  const claim = claimText.toLowerCase();

  const keywords = claim
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 8);

  const matchCount = keywords.filter((kw) => combined.includes(kw)).length;
  const contradicts = /wrong|incorrect|false|myth|debunked|不准确|错误|谣言/.test(combined);

  if (contradicts) return 'refuting';
  if (matchCount >= 3) return 'supporting';
  if (matchCount >= 1) return 'supporting';
  return 'neutral';
}
