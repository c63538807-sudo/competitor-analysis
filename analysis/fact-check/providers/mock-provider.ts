// ============================================================
// Fact Check — Mock Search Provider
// ============================================================
// Returns simulated search results. Used for testing and as
// the default provider until a real search provider is wired.

import type { Claim } from '../types';
import type { ISearchProvider, SearchResult } from './provider';
import { SearchError } from './provider';

// -----------------------------------------------------------
// Known facts database (for consistent mock results)
// -----------------------------------------------------------

interface KnownFact {
  keywords: string[];
  results: SearchResult[];
}

const KNOWN_FACTS: KnownFact[] = [
  {
    keywords: ['诺贝尔', 'nobel', 'hopfield', 'hinton', '2025'],
    results: [
      {
        title: 'Nobel Prize Official — Physics 2025',
        url: 'https://www.nobelprize.org/prizes/physics/2025/summary/',
        snippet: 'The 2025 Nobel Prize in Physics was awarded to John J. Hopfield and Geoffrey E. Hinton for foundational discoveries and inventions that enable machine learning with artificial neural networks.',
        sourceType: 'official',
        relevance: 'high',
        direction: 'supporting',
      },
      {
        title: 'Wikipedia — 2025 Nobel Prize in Physics',
        url: 'https://en.wikipedia.org/wiki/2025_Nobel_Prize_in_Physics',
        snippet: 'John Hopfield and Geoffrey Hinton received the prize for their work on artificial neural networks.',
        sourceType: 'encyclopedia',
        relevance: 'high',
        direction: 'supporting',
      },
    ],
  },
  {
    keywords: ['清华大学', 'tsinghua'],
    results: [
      {
        title: '清华大学官网',
        url: 'https://www.tsinghua.edu.cn/',
        snippet: '清华大学成立于1911年，是中国最著名的高等学府之一。',
        sourceType: 'official',
        relevance: 'high',
        direction: 'supporting',
      },
    ],
  },
  {
    keywords: ['苹果', 'apple', '1976'],
    results: [
      {
        title: 'Apple Inc. — History',
        url: 'https://en.wikipedia.org/wiki/Apple_Inc.',
        snippet: 'Apple was founded on April 1, 1976, by Steve Jobs, Steve Wozniak, and Ronald Wayne.',
        sourceType: 'encyclopedia',
        relevance: 'high',
        direction: 'supporting',
      },
    ],
  },
  {
    keywords: ['爱因斯坦', 'einstein', '相对论', 'relativity'],
    results: [
      {
        title: 'Wikipedia — Albert Einstein',
        url: 'https://en.wikipedia.org/wiki/Albert_Einstein',
        snippet: 'Albert Einstein developed the theory of relativity, one of the two pillars of modern physics.',
        sourceType: 'encyclopedia',
        relevance: 'high',
        direction: 'supporting',
      },
    ],
  },
];

// -----------------------------------------------------------
// Refutation patterns (claims known to be false)
// -----------------------------------------------------------

const REFUTED_CLAIMS: { pattern: RegExp; result: SearchResult }[] = [
  {
    pattern: /爱因斯坦.*进化论|einstein.*evolution/i,
    result: {
      title: 'Encyclopedia Britannica — Albert Einstein',
      url: 'https://www.britannica.com/biography/Albert-Einstein',
      snippet: 'Einstein is known for the theory of relativity, not evolution. The theory of evolution was developed by Charles Darwin.',
      sourceType: 'encyclopedia',
      relevance: 'high',
      direction: 'refuting',
    },
  },
  {
    pattern: /诺贝尔.*数学|nobel.*math/i,
    result: {
      title: 'Nobel Prize — FAQ',
      url: 'https://www.nobelprize.org/faq/',
      snippet: 'There is no Nobel Prize in mathematics. The Fields Medal is often considered the equivalent.',
      sourceType: 'official',
      relevance: 'high',
      direction: 'refuting',
    },
  },
];

// -----------------------------------------------------------
// Mock Provider
// -----------------------------------------------------------

export class MockSearchProvider implements ISearchProvider {
  readonly name = 'mock';

  private delayMs: number;
  private failOnNext: boolean = false;

  constructor(delayMs: number = 0) {
    this.delayMs = delayMs;
  }

  /** Make the next search() call throw an error (for testing). */
  failNext(): void {
    this.failOnNext = true;
  }

  async search(claim: Claim): Promise<SearchResult[]> {
    // Simulate network delay
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    // Simulate failure
    if (this.failOnNext) {
      this.failOnNext = false;
      throw new SearchError('Mock provider failure (simulated)', this.name, true);
    }

    // Check refutation patterns first
    for (const ref of REFUTED_CLAIMS) {
      if (ref.pattern.test(claim.text)) {
        return [ref.result];
      }
    }

    // Check known facts
    const lower = claim.text.toLowerCase();
    for (const fact of KNOWN_FACTS) {
      const matchCount = fact.keywords.filter((kw) => lower.includes(kw.toLowerCase())).length;
      if (matchCount >= 2) {
        return fact.results;
      }
    }

    // No results found → empty
    return [];
  }
}
