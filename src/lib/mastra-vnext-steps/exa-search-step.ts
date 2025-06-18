import { z } from 'zod';
import { createStep } from '@mastra/core/workflows';
import Exa from 'exa-js';
import type { SearchResponse, SearchResult, ContentsOptions } from 'exa-js';
import { searchProviderInput, searchProviderOutput } from '../mastra-vnext-schemas';

/**
 * Exa Search Step
 * 
 * Uses the Exa API to perform web search with content extraction.
 * Exa provides high-quality search results with the ability to extract
 * content directly from pages.
 */
export const exaSearchStep = createStep({
  id: 'exa-search',
  description: 'Performs web search using Exa with content extraction',
  inputSchema: searchProviderInput,
  outputSchema: searchProviderOutput,
  async execute({ inputData, runtimeContext, emitter }) {
    const { enhancedQuery, subQuestions, numResults } = inputData;
    const { EXA_API_KEY, searchId } = runtimeContext.getAll();

    console.log(`[Step: exa-search] Started for searchId: ${searchId}, query: ${enhancedQuery}`);
    
    // Emit status update event
    await emitter.emit('watch', {
      type: 'watch',
      payload: {
        currentStep: {
          id: 'exa-search',
          status: 'running',
          payload: { provider: 'Exa', query: enhancedQuery }
        }
      },
      eventTimestamp: new Date()
    });

    // Validate API key
    if (!EXA_API_KEY) {
      console.error("[Step: exa-search] Missing EXA_API_KEY");
      
      // Emit error event
      await emitter.emit('watch', {
        type: 'watch',
        payload: {
          currentStep: {
            id: 'exa-search',
            status: 'failed',
            payload: { provider: 'Exa', message: 'Missing API key for Exa search' }
          }
        },
        eventTimestamp: new Date()
      });
      
      return { searchProvider: 'Exa', results: [] };
    }

    const exa = new Exa(EXA_API_KEY);
    let searchResults: z.infer<typeof searchProviderOutput>['results'] = [];

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
      console.log(`[Step: exa-search] Executing main search for "${enhancedQuery}"`);
      const response: SearchResponse<ContentsOptions> = await exa.searchAndContents(enhancedQuery, {
        numResults: numResults || 5,
        ...searchOptions,
        useAuthorDate: true, // Include author and date info when available
        useRecency: true, // Prioritize recent content
      });

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
      
      console.log(`[Step: exa-search] Found ${searchResults.length} results from main query`);
      
      // Process subquestions if provided
      if (subQuestions && subQuestions.length > 0) {
        // Process each subquestion (limit to 2 to control API usage)
        const subQuestionResults = await Promise.allSettled(
          subQuestions.slice(0, 2).map(async (question, index) => {
            console.log(`[Step: exa-search] Executing subquery ${index + 1}: "${question}"`);
            
            // Use simple search for subquestions to save processing time
            const subResponse = await exa.search(question, {
              numResults: Math.max(2, Math.floor((numResults || 5) / 2)),
              useAuthorDate: true,
              highlights: 2
            });
            
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
        
        console.log(`[Step: exa-search] Found ${uniqueSubResults.length} additional results from subqueries`);
        
        // Add unique subresults to main results
        searchResults = [...searchResults, ...uniqueSubResults];
      }
      
      // Sort by score
      searchResults.sort((a, b) => (b.score || 0) - (a.score || 0));
      
      console.log(`[Step: exa-search] Final result count: ${searchResults.length}`);
      
      // Emit completion event
      await emitter.emit('watch', {
        type: 'watch',
        payload: {
          currentStep: {
            id: 'exa-search',
            status: 'completed',
            payload: { 
              provider: 'Exa', 
              count: searchResults.length, 
              results: searchResults.map(r => r.url).slice(0, 5) // Send only top 5 URLs to reduce payload size
            }
          }
        },
        eventTimestamp: new Date()
      });
    } catch (error: any) {
      console.error(`[Step: exa-search] Error during Exa search:`, error);
      
      // Try fallback approach with basic search
      try {
        console.log(`[Step: exa-search] Attempting fallback basic search`);
        const fallbackResponse = await exa.search(enhancedQuery, {
          numResults: numResults || 5,
          useAuthorDate: true
        });
        
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
          
          console.log(`[Step: exa-search] Fallback search found ${searchResults.length} results`);
        }
        
        // Emit completion event with fallback flag
        await emitter.emit('watch', {
          type: 'watch',
          payload: {
            currentStep: {
              id: 'exa-search',
              status: 'completed',
              payload: { 
                provider: 'Exa', 
                count: searchResults.length, 
                results: searchResults.map(r => r.url).slice(0, 5),
                fallback: true
              }
            }
          },
          eventTimestamp: new Date()
        });
      } catch (fallbackError) {
        console.error(`[Step: exa-search] Fallback search also failed:`, fallbackError);
        
        // Emit error event
        await emitter.emit('watch', {
          type: 'watch',
          payload: {
            currentStep: {
              id: 'exa-search',
              status: 'failed',
              payload: { 
                provider: 'Exa', 
                message: 'Failed to fetch results from Exa.',
                error: error.message
              }
            }
          },
          eventTimestamp: new Date()
        });
      }
    }

    return {
      searchProvider: 'Exa',
      results: searchResults,
    };
  },
});
