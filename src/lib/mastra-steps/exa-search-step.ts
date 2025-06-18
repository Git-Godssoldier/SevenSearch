import { z } from 'zod';
import { createStep, type WorkflowContext } from '../mastra-types';
import Exa from 'exa-js';
import type { SearchResponse, SearchResult, ContentsOptions } from 'exa-js';
import {
  SearchProviderInputSchema,
  IndividualSearchResultsSchema,
  type IndividualSearchResultItemSchema,
  type StreamChunkOutputSchema,
} from '../mastra-schemas';

/**
 * Exa Search Step
 * 
 * Uses the Exa API to perform web search with content extraction.
 * Exa provides high-quality search results with the ability to extract
 * content directly from pages.
 */
export const exaSearchStep = createStep({
  name: 'ExaSearchStep',
  inputSchema: SearchProviderInputSchema,
  outputSchema: IndividualSearchResultsSchema,
  async execute({ data, context }: { data: z.infer<typeof SearchProviderInputSchema>, context: WorkflowContext }) {
    const { enhancedQuery, subQuestions, numResults } = data;
    const { EXA_API_KEY, pushUpdateToClient, searchId, userId } = context;

    console.log(`[MastraStep: ${this.name}] Started for searchId: ${searchId}, query: ${enhancedQuery}`);
    pushUpdateToClient({
      step: 2, 
      type: 'search_provider_exa_started',
      payload: { provider: 'Exa', query: enhancedQuery },
    });

    // Validate API key
    if (!EXA_API_KEY) {
      console.error("[MastraStep: ExaSearchStep] Missing EXA_API_KEY");
      pushUpdateToClient({
        step: 2,
        type: 'error',
        payload: { provider: 'Exa', message: 'Missing API key for Exa search' },
        error: true,
        errorType: 'missing_api_key',
      });
      return { searchProvider: 'Exa', results: [] };
    }

    const exa = new Exa(EXA_API_KEY);
    let searchResults: z.infer<typeof IndividualSearchResultItemSchema>[] = [];

    try {
      // Configure search options
      const searchOptions: ContentsOptions = {
        highlights: { 
          numSentences: 3, // Increase for more context
          highlightsPerUrl: 2, // Get multiple highlights per result
          query: enhancedQuery 
        },
      };
      
      // Execute main query search
      console.log(`[MastraStep: ${this.name}] Executing main search for "${enhancedQuery}"`);
      const response: SearchResponse<ContentsOptions> = await exa.searchAndContents(enhancedQuery, {
        numResults: numResults || 5,
        ...searchOptions,
        useRecency: true, // Prioritize recent content
      } as any);

      if (response.results) {
        searchResults = response.results.map((resultUntyped: SearchResult<ContentsOptions>) => {
          const result = resultUntyped as any; 
          let snippetFromHighlights: string | undefined = undefined;
          if (result.highlights && Array.isArray(result.highlights) && result.highlights.length > 0) {
            snippetFromHighlights = result.highlights.join(" ... ");
          }

          return {
            id: result.id || `exa-${searchResults.length}`,
            url: result.url,
            title: result.title ?? 'Untitled',
            snippet: snippetFromHighlights || result.text?.substring(0, 300) || '',
            rawContent: result.text || undefined,
            score: result.score || 1.0,
            provider: 'Exa',
            author: result.author,
            publishedDate: result.published_date || result.publishedDate,
            highlights: (result.highlights as string[] | undefined)?.map((hText: string) => ({ 
              text: hText, 
              score: 1.0 
            })) || undefined,
          };
        });
      }
      
      console.log(`[MastraStep: ${this.name}] Found ${searchResults.length} results from main query`);
      
      // Process subquestions if provided
      if (subQuestions && subQuestions.length > 0) {
        // Process each subquestion (limit to 2 to control API usage)
        const subQuestionResults = await Promise.allSettled(
          subQuestions.slice(0, 2).map(async (question, index) => {
            console.log(`[MastraStep: ${this.name}] Executing subquery ${index + 1}: "${question}"`);
            
            // Use simple search for subquestions to save processing time
            const subResponse = await exa.search(question, {
              numResults: Math.max(2, Math.floor((numResults || 5) / 2)),
              highlights: 2
            } as any);
            
            return subResponse.results.map((result: any) => ({
              id: `exa-sub-${index}-${result.id || Math.random().toString(36).substring(2, 10)}`,
              url: result.url,
              title: result.title || 'Untitled',
              snippet: result.highlights?.join(' ... ') || result.text?.substring(0, 200) || '',
              rawContent: result.text,
              score: (result.score || 0.9) * 0.9, // Reduce score slightly for subqueries
              provider: 'Exa-Sub',
              author: result.author,
              publishedDate: result.published_date || result.publishedDate,
              highlights: result.highlights?.map((text: string) => ({ 
                text, 
                score: 0.9 
              })) || undefined
            }));
          })
        );
        
        // Process results from fulfilled promises
        const subResults = subQuestionResults
          .filter((result): result is PromiseFulfilledResult<any[]> => result.status === 'fulfilled')
          .map(result => result.value)
          .flat();
          
        // Deduplicate by URL before adding to main results
        const existingUrls = new Set(searchResults.map(r => r.url));
        const uniqueSubResults = subResults.filter(r => !existingUrls.has(r.url));
        
        console.log(`[MastraStep: ${this.name}] Found ${uniqueSubResults.length} additional results from subqueries`);
        
        // Add unique subresults to main results
        searchResults = [...searchResults, ...uniqueSubResults];
      }
      
      // Sort by score
      searchResults.sort((a, b) => (b.score || 0) - (a.score || 0));
      
      console.log(`[MastraStep: ${this.name}] Final result count: ${searchResults.length}`);
      pushUpdateToClient({
        step: 2,
        type: 'search_provider_exa_completed',
        payload: { 
          provider: 'Exa', 
          count: searchResults.length, 
          results: searchResults.map(r => r.url).slice(0, 5) // Send only top 5 URLs to reduce payload size
        },
      });
    } catch (error: any) {
      console.error(`[MastraStep: ${this.name}] Error during Exa search:`, error);
      
      // Try fallback approach with basic search
      try {
        console.log(`[MastraStep: ${this.name}] Attempting fallback basic search`);
        const fallbackResponse = await exa.search(enhancedQuery, {
          numResults: numResults || 5
        } as any);
        
        if (fallbackResponse.results) {
          searchResults = fallbackResponse.results.map((result: any) => ({
            id: result.id || `exa-fallback-${Math.random().toString(36).substring(2, 10)}`,
            url: result.url,
            title: result.title || 'Untitled',
            snippet: result.highlights?.join(' ... ') || result.text?.substring(0, 200) || '',
            rawContent: undefined,
            score: result.score || 0.8, // Slightly lower score for fallback results
            provider: 'Exa',
            author: result.author,
            publishedDate: result.published_date || result.publishedDate
          }));
          
          console.log(`[MastraStep: ${this.name}] Fallback search found ${searchResults.length} results`);
        }
        
        pushUpdateToClient({
          step: 2,
          type: 'search_provider_exa_completed',
          payload: { 
            provider: 'Exa', 
            count: searchResults.length, 
            results: searchResults.map(r => r.url).slice(0, 5),
            fallback: true
          },
        });
      } catch (fallbackError) {
        console.error(`[MastraStep: ${this.name}] Fallback search also failed:`, fallbackError);
        
        // Send error update to client
        pushUpdateToClient({
          step: 2,
          type: 'error',
          payload: { 
            provider: 'Exa', 
            message: 'Failed to fetch results from Exa.',
            error: error.message
          },
          error: true,
          errorType: 'exa_search_error',
        });
      }
    }

    return {
      searchProvider: 'Exa',
      results: searchResults,
    };
  },
});