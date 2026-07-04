# Fact Check — Search Providers

## Architecture

All search providers implement `ISearchProvider` from `provider.ts`. The checker module depends ONLY on this interface — never on a concrete provider.

```
ISearchProvider
├── MockSearchProvider      ← default (testing / offline)
├── (future) OpenAISearchProvider
├── (future) GeminiSearchProvider
├── (future) PerplexitySearchProvider
└── (future) CustomSearchProvider
```

## How to add a new provider

1. Create `my-provider.ts` in this directory
2. Implement `ISearchProvider`:

```ts
import { ISearchProvider, SearchResult } from './provider';
import type { Claim } from '../types';

export class MySearchProvider implements ISearchProvider {
  readonly name = 'my-provider';

  async search(claim: Claim): Promise<SearchResult[]> {
    // Call your search API here
    // Return 0–N SearchResult objects
  }
}
```

3. Register it in `checker.ts`:

```ts
import { MySearchProvider } from './providers/my-provider';
setSearchProvider(new MySearchProvider());
```

## Interface contract

`search(claim)` must:
- Accept a `Claim` object (id, text, sourceAnswerer, etc.)
- Return `SearchResult[]` (empty array = no relevant info)
- Throw `SearchError` if the provider is unavailable
- Not modify the input claim

## Current providers

| Provider | Status | Network | Notes |
|----------|--------|---------|-------|
| `BraveSearchProvider` | ✅ Active | Yes | Brave Search API — free 2,000/mo |
| `MockSearchProvider` | ✅ Active | No | Returns simulated results (fallback) |
| OpenAI (Web Search) | ⬜ Planned | Yes | Use GPT-4o with web_search tool |
| Gemini (Grounding) | ⬜ Planned | Yes | Use Gemini with Google Search grounding |

## Brave Search Setup

1. Register at https://brave.com/search/api/ (free, no credit card)
2. `export BRAVE_API_KEY="BSA..."`
3. The provider auto-activates when the env var is set
