/**
 * Exa Search Provider
 * 
 * This provider implements integration with the Exa search API
 * for Project Gargantua's planning and execution phases.
 */

// Define result type that matches PlanningSearchResult
interface ExaSearchResult {
  title: string;
  url: string;
  snippet?: string;
  source: string;
  confidence?: number;
  relevance?: number;
  metadata?: Record<string, any>;
}

/**
 * Create an Exa search provider
 * @param apiKey Exa API key
 * @returns A search provider implementation
 */
export function exaSearchProvider(apiKey: string) {
  // Validate API key
  if (!apiKey) {
    throw new Error('Exa API key is required');
  }

  return {
    /**
     * Search the Exa API
     * @param query Search query
     * @param options Search options
     * @returns Array of search results
     */
    search: async (
      query: string, 
      options: { 
        queryType?: string;
        limit?: number;
        recency?: 'day' | 'week' | 'month' | 'year';
        domains?: string[];
      } = {}
    ): Promise<ExaSearchResult[]> => {
      try {
        console.log(`[ExaProvider] Searching for: "${query}"`);
        
        // Default options
        const limit = options.limit || 5;
        
        // Configure search parameters based on options
        const searchParams: Record<string, any> = {
          query,
          numResults: limit,
          useAutoprompt: true
        };
        
        // Apply recency filter if specified
        if (options.recency) {
          let startDate: string;
          const now = new Date();
          
          switch (options.recency) {
            case 'day':
              const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
              startDate = oneDayAgo.toISOString().split('T')[0];
              break;
            case 'week':
              const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              startDate = oneWeekAgo.toISOString().split('T')[0];
              break;
            case 'month':
              const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
              startDate = oneMonthAgo.toISOString().split('T')[0];
              break;
            case 'year':
              const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
              startDate = oneYearAgo.toISOString().split('T')[0];
              break;
          }
          
          if (startDate) {
            searchParams.startPublishedDate = startDate;
          }
        }
        
        // Apply domain filters if specified
        if (options.domains && options.domains.length > 0) {
          searchParams.includeDomains = options.domains;
        }
        
        // Make the API call
        const response = await fetch('https://api.exa.ai/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
          },
          body: JSON.stringify(searchParams)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Exa API error: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        
        // Transform Exa results to our standard format
        const results: ExaSearchResult[] = data.results.map((result: any) => ({
          title: result.title || 'No title',
          url: result.url,
          snippet: result.text?.substring(0, 300) || undefined,
          source: 'exa',
          confidence: 0.8,
          relevance: result.score !== undefined ? result.score / 100 : undefined,
          metadata: {
            published: result.publishedDate,
            highlightedText: result.highlights,
            domain: new URL(result.url).hostname
          }
        }));
        
        console.log(`[ExaProvider] Found ${results.length} results`);
        return results;
      } catch (error) {
        console.error('[ExaProvider] Search error:', error);
        throw error;
      }
    }
  };
}

export default exaSearchProvider;