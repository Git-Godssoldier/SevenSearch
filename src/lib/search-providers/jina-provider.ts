/**
 * Jina Search Provider
 * 
 * This provider implements integration with the Jina neural search API
 * for Project Gargantua's planning and execution phases.
 */

// Define result type that matches PlanningSearchResult
interface JinaSearchResult {
  title: string;
  url: string;
  snippet?: string;
  source: string;
  confidence?: number;
  relevance?: number;
  metadata?: Record<string, any>;
}

/**
 * Create a Jina search provider
 * @param apiKey Jina API key
 * @returns A search provider implementation
 */
export function jinaSearchProvider(apiKey: string) {
  // Validate API key
  if (!apiKey) {
    throw new Error('Jina API key is required');
  }

  return {
    /**
     * Search the Jina API
     * @param query Search query
     * @param options Search options
     * @returns Array of search results
     */
    search: async (
      query: string, 
      options: { 
        queryType?: string;
        limit?: number;
        filters?: Record<string, any>;
      } = {}
    ): Promise<JinaSearchResult[]> => {
      try {
        console.log(`[JinaProvider] Searching for: "${query}"`);
        
        // Default options
        const limit = options.limit || 5;
        
        // Prepare request data
        const requestData = {
          queries: [{
            query,
            top_k: limit,
            filter: options.filters || {}
          }]
        };
        
        // Adapt request based on query type
        if (options.queryType) {
          // Semantic or keyword search depending on query type
          switch (options.queryType) {
            case 'strategy_research':
            case 'term_definition':
            case 'related_concepts':
              // These need more semantic understanding
              requestData.queries[0].search_type = 'semantic';
              break;
            case 'domain_exploration':
            case 'source_credibility':
              // These work better with keyword search
              requestData.queries[0].search_type = 'keyword';
              break;
            default:
              // Default to hybrid search
              requestData.queries[0].search_type = 'hybrid';
          }
        }
        
        // Make the API call
        const response = await fetch('https://api.jina.ai/v1/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Jina API error: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        
        // Transform Jina results to our standard format
        const results: JinaSearchResult[] = [];
        
        if (data.data && data.data[0] && data.data[0].matches) {
          for (const match of data.data[0].matches) {
            results.push({
              title: match.title || 'No title',
              url: match.url || match.source_url || 'https://example.com',
              snippet: match.text || match.content?.substring(0, 300) || undefined,
              source: 'jina',
              confidence: match.score,
              relevance: match.relevance_score !== undefined ? match.relevance_score : match.score,
              metadata: {
                documentId: match.id,
                embedding: match.embedding ? true : false,
                tags: match.tags || []
              }
            });
          }
        }
        
        console.log(`[JinaProvider] Found ${results.length} results`);
        return results;
      } catch (error) {
        console.error('[JinaProvider] Search error:', error);
        throw error;
      }
    }
  };
}

/**
 * Search with Jina API
 * 
 * This is a standalone function that can be used without creating a provider instance
 * 
 * @param query The search query
 * @param jinaApiKey Jina API key
 * @param options Search options
 * @returns Array of search results
 */
export async function searchWithJina(
  query: string,
  jinaApiKey: string,
  options: {
    limit?: number;
    filters?: Record<string, any>;
  } = {}
): Promise<JinaSearchResult[]> {
  const provider = jinaSearchProvider(jinaApiKey);
  return provider.search(query, options);
}

/**
 * Perform a deep search with Jina API
 * 
 * Performs a multi-stage search process:
 * 1. Initial search with the main query
 * 2. Generate follow-up queries based on initial results
 * 3. Search with follow-up queries and combine results
 * 
 * @param query The main search query
 * @param jinaApiKey Jina API key
 * @param options Deep search options
 * @returns Array of search results from all search stages
 */
export async function searchWithJinaDeepSearch(
  query: string,
  jinaApiKey: string,
  options: {
    limit?: number;
    depth?: number;
    followUpQueries?: string[];
  } = {}
): Promise<JinaSearchResult[]> {
  // Default options
  const limit = options.limit || 5;
  const depth = options.depth || 1;
  
  // Stage 1: Initial search
  console.log(`[JinaDeepSearch] Starting deep search for: "${query}"`);
  const initialResults = await searchWithJina(query, jinaApiKey, { limit });
  
  // If depth is 1 or we got no results, return initial results
  if (depth <= 1 || initialResults.length === 0) {
    return initialResults;
  }
  
  // Stage 2: Follow-up searches with derived or provided queries
  const followUpQueries = options.followUpQueries || [
    `${query} definition`,
    `${query} examples`,
    `${query} research`
  ];
  
  // Run follow-up searches in parallel
  const followUpSearches = followUpQueries.map(followUpQuery => 
    searchWithJina(followUpQuery, jinaApiKey, { limit: Math.floor(limit / followUpQueries.length) })
  );
  
  // Wait for all follow-up searches to complete
  const followUpResults = await Promise.all(followUpSearches);
  
  // Stage 3: Combine and deduplicate results
  const allResults = [...initialResults];
  const seenUrls = new Set(initialResults.map(r => r.url));
  
  // Add unique results from follow-up searches
  for (const results of followUpResults) {
    for (const result of results) {
      if (!seenUrls.has(result.url)) {
        allResults.push(result);
        seenUrls.add(result.url);
      }
    }
  }
  
  // Sort by relevance/confidence
  allResults.sort((a, b) => {
    const aScore = a.relevance || a.confidence || 0;
    const bScore = b.relevance || b.confidence || 0;
    return bScore - aScore;
  });
  
  // Limit total results
  const finalResults = allResults.slice(0, limit);
  console.log(`[JinaDeepSearch] Combined ${allResults.length} results from all searches, returning top ${finalResults.length}`);
  
  return finalResults;
}

export default jinaSearchProvider;