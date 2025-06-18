import { z } from 'zod';
import { createStep } from '../mastra-types';
import { SearchProviderInputSchema, IndividualSearchResultsSchema } from '../mastra-schemas';
import FirecrawlApp from '@mendable/firecrawl-js';

export const firecrawlSearchStep = createStep({
  name: 'firecrawl-search',
  inputSchema: SearchProviderInputSchema,
  outputSchema: IndividualSearchResultsSchema,
  async execute({ data, context }) {
    const { enhancedQuery } = data;
    const { FIRECRAWL_API_KEY } = context.user;

    if (!FIRECRAWL_API_KEY) {
      throw new Error('Missing FIRECRAWL_API_KEY');
    }

    const app = new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY });

    const searchResults = await app.search(enhancedQuery, {
      pageOptions: {
        fetchPageContent: true
      }
    });

    return {
      searchProvider: 'firecrawl',
      results: searchResults.data.map((result: any) => ({
        id: result.id,
        url: result.url,
        title: result.title,
        snippet: result.snippet,
        rawContent: result.rawContent,
        score: result.score,
        provider: 'firecrawl',
      })),
    };
  },
});
