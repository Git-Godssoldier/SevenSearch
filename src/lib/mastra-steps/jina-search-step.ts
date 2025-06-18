import { z } from 'zod';
import { createStep, type WorkflowContext } from '../mastra-types';
import axios from 'axios';
import {
  SearchProviderInputSchema,
  IndividualSearchResultsSchema,
  type IndividualSearchResultItemSchema,
  type StreamChunkOutputSchema,
} from '../mastra-schemas';

/**
 * Jina Search Step
 * 
 * Performs web search using Jina's search API, which provides high-quality
 * semantic search results optimized for relevance.
 */
export const jinaSearchStep = createStep({
  name: 'JinaSearchStep',
  inputSchema: SearchProviderInputSchema,
  outputSchema: IndividualSearchResultsSchema,
  async execute({ data, context }: { data: z.infer<typeof SearchProviderInputSchema>, context: WorkflowContext }) {
    const { enhancedQuery, numResults, subQuestions = [] } = data;
    const { JINA_API_KEY, pushUpdateToClient, searchId, userId } = context;

    console.log(`[MastraStep: ${this.name}] Started for searchId: ${searchId}, query: ${enhancedQuery}`);
    pushUpdateToClient({
      step: 2, 
      type: 'search_provider_jina_started',
      payload: { provider: 'Jina', query: enhancedQuery },
    });

    // Production API endpoint for Jina search
    const JINA_SEARCH_API = 'https://api.jina.ai/v1/search';
    
    let searchResults: z.infer<typeof IndividualSearchResultItemSchema>[] = [];

    try {
      // Set up headers for Jina API
      const headers = {
        'Authorization': `Bearer ${JINA_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      // Jina Search API request parameters
      const requestBody = {
        query: enhancedQuery,
        limit: numResults || 5,
        type: 'web',
        include_content: true,
        safe_search: true
      };
      
      // Execute search request
      const response = await axios.post(JINA_SEARCH_API, requestBody, { headers });
      
      if (response.data && response.data.results) {
        searchResults = response.data.results.map((result: any) => {
          return {
            id: result.id || result.url,
            url: result.url,
            title: result.title || 'Untitled',
            snippet: result.snippet || (result.content ? result.content.substring(0, 200) + '...' : ''),
            rawContent: result.content,
            score: result.score || 1.0,
            provider: 'Jina',
            author: result.author,
            publishedDate: result.published_date,
            highlights: result.highlights ? result.highlights.map((highlight: string) => ({
              text: highlight,
              score: 1.0
            })) : undefined
          };
        });
      }
      
      console.log(`[MastraStep: ${this.name}] Found ${searchResults.length} results from Jina.`);
      
      // Execute sub-question searches if provided
      if (subQuestions.length > 0) {
        // Process each sub-question in parallel
        const subQuestionResults = await Promise.all(
          subQuestions.slice(0, 2).map(async (question) => {
            try {
              const subResponse = await axios.post(JINA_SEARCH_API, {
                query: question,
                limit: Math.max(2, Math.floor((numResults || 5) / 2)),
                type: 'web',
                include_content: true,
                safe_search: true
              }, { headers });
              
              if (subResponse.data && subResponse.data.results) {
                return subResponse.data.results.map((result: any) => ({
                  id: result.id || result.url,
                  url: result.url,
                  title: result.title || 'Untitled',
                  snippet: result.snippet || (result.content ? result.content.substring(0, 200) + '...' : ''),
                  rawContent: result.content,
                  score: (result.score || 1.0) * 0.9, // Slightly lower weight for sub-questions
                  provider: 'Jina-Sub',
                  author: result.author,
                  publishedDate: result.published_date,
                  highlights: result.highlights ? result.highlights.map((highlight: string) => ({
                    text: highlight,
                    score: 0.9
                  })) : undefined
                }));
              }
              return [];
            } catch (error) {
              console.error(`[MastraStep: ${this.name}] Error in sub-question search: ${error}`);
              return [];
            }
          })
        );
        
        // Flatten sub-question results
        const flattenedSubResults = subQuestionResults.flat();
        
        // Deduplicate by URL
        const urlSet = new Set(searchResults.map(r => r.url));
        const uniqueSubResults = flattenedSubResults.filter(r => !urlSet.has(r.url));
        
        // Add unique sub-results
        searchResults = [...searchResults, ...uniqueSubResults];
      }
      
      // Sort results by score (descending)
      searchResults.sort((a, b) => (b.score || 0) - (a.score || 0));
      
      // Send update to client
      pushUpdateToClient({
        step: 2,
        type: 'search_provider_jina_completed',
        payload: { 
          provider: 'Jina', 
          count: searchResults.length, 
          results: searchResults.map(r => r.url)
        },
      });
    } catch (error) {
      console.error(`[MastraStep: ${this.name}] Error during Jina search:`, error);
      
      // Try a fallback approach with simpler parameters
      try {
        const fallbackResponse = await axios.post(JINA_SEARCH_API, {
          query: enhancedQuery,
          limit: numResults || 5,
          type: 'web',
          include_content: false,
        }, { 
          headers: {
            'Authorization': `Bearer ${JINA_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        
        if (fallbackResponse.data && fallbackResponse.data.results) {
          searchResults = fallbackResponse.data.results.map((result: any) => ({
            id: result.id || result.url,
            url: result.url,
            title: result.title || 'Untitled',
            snippet: result.snippet || '',
            rawContent: undefined,
            score: result.score || 1.0,
            provider: 'Jina',
            author: undefined,
            publishedDate: undefined,
            highlights: undefined
          }));
          
          console.log(`[MastraStep: ${this.name}] Found ${searchResults.length} results with fallback approach.`);
        }
      } catch (fallbackError) {
        console.error(`[MastraStep: ${this.name}] Fallback search also failed: ${fallbackError}`);
        
        // Send error update to client
        pushUpdateToClient({
          step: 2,
          type: 'error',
          payload: { provider: 'Jina', message: 'Failed to fetch results from Jina.' },
          error: true,
          errorType: 'jina_search_error',
        });
      }
    }

    return {
      searchProvider: 'Jina',
      results: searchResults,
    };
  },
});