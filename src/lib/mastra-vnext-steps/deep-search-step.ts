import { z } from 'zod';
import { createStep } from '../mastra-vnext-utils/step';
import { EventStreamWriter } from '../mastra-vnext-utils/stream-events';
import { extractThinkSections, extractCitations } from '../utils/content-processing';
import { searchWithJinaDeepSearch, searchWithJina } from '../search-providers/jina';

// Input schema with query parameter
const deepSearchInputSchema = z.object({
  query: z.string().min(1),
  userId: z.string().optional(),
  searchSessionId: z.string().optional(),
  settings: z.object({
    prioritizeSources: z.array(z.string()).optional(),
    excludeSources: z.array(z.string()).optional(),
    maxResults: z.number().optional(),
  }).optional(),
});

// Deep search result item schema
const deepSearchResultItemSchema = z.object({
  url: z.string(),
  title: z.string(),
  snippet: z.string(),
  highlights: z.array(z.string()).optional(),
  source: z.string().optional(),
  publishDate: z.string().optional(),
  authors: z.array(z.string()).optional(),
  citationNumber: z.number().optional(),
});

// Output schema for deep search results
const deepSearchOutputSchema = z.object({
  results: z.array(deepSearchResultItemSchema),
  reasoning: z.string().optional(),
  usage: z.object({
    modelName: z.string().optional(),
    totalTokens: z.number().optional(),
    promptTokens: z.number().optional(),
    completionTokens: z.number().optional(),
  }).optional(),
});

/**
 * Native vNext Deep Search step implementation
 * Uses Jina DeepSearch API to perform detailed research-style search with reasoning
 */
export const deepSearchStep = createStep({
  id: 'deep-search',
  name: 'Deep Search',
  description: 'Perform deep semantic search with reasoning for complex queries',
  inputSchema: deepSearchInputSchema,
  outputSchema: deepSearchOutputSchema,
  
  async execute({ inputData, runtimeContext, emitter }) {
    // Create event helpers for standardized event emission
    const events = EventStreamWriter.createStepEventHelpers(emitter, 'deep-search');
    
    try {
      // Emit running status event
      await events.emitRunning({ 
        query: inputData.query,
        message: "Starting deep search analysis" 
      });
      
      // Extract query from input data
      const { query, userId, searchSessionId, settings = {} } = inputData;
      
      // Emit progress event - starting
      await events.emitProgress(10, "Initiating deep search analysis");
      
      // Prepare search settings
      const searchSettings = {
        maxResults: settings.maxResults || 8,
        prioritizeSources: settings.prioritizeSources || ["edu", "gov", "org"],
        excludeSources: settings.excludeSources || [],
      };
      
      // Emit progress event - preparing search
      await events.emitProgress(30, "Analyzing query and preparing search");
      
      // Custom system prompt for research-style search
      const systemPrompt = `You are a research assistant tasked with finding accurate, factual information. 
Analyze the query carefully, provide reasoning about what information needs to be found, and then search for that information.
Use educational and government sources when possible. Format your citations properly with numbered references.
Always include your thinking process in <think></think> tags.`;
      
      // Emit progress event - executing search
      await events.emitProgress(50, "Executing deep search");
      
      // Execute deep search with Jina
      const deepSearchResponse = await searchWithJinaDeepSearch({
        query,
        systemPrompt,
        maxResults: searchSettings.maxResults,
        prioritizeSources: searchSettings.prioritizeSources,
        excludeSources: searchSettings.excludeSources,
        userId,
        searchSessionId,
      });
      
      // Emit progress event - processing results
      await events.emitProgress(70, "Processing search results");
      
      // Extract reasoning from think sections
      const reasoning = extractThinkSections(deepSearchResponse.content);
      
      // Extract citations from markdown footnotes
      const citations = extractCitations(deepSearchResponse.content);
      
      // Emit custom event for reasoning
      if (reasoning) {
        await events.emitCustom('reasoning', { reasoning });
      }
      
      // Emit progress event - formatting results
      await events.emitProgress(80, "Formatting search results");
      
      // Format results from citations
      const results = citations.map((citation, index) => {
        return {
          url: citation.url || `https://placeholder.com/citation-${index + 1}`,
          title: citation.title || `Citation ${index + 1}`,
          snippet: citation.snippet || citation.context || "",
          highlights: citation.highlights || [],
          source: citation.source,
          publishDate: citation.publishDate,
          authors: citation.authors,
          citationNumber: index + 1,
        };
      });
      
      // Emit custom event for results found
      await events.emitCustom('results', { 
        count: results.length,
        preview: results.slice(0, 3).map(r => r.title) 
      });
      
      // Check if we have enough results
      if (results.length < 3 && deepSearchResponse.usage?.totalTokens) {
        await events.emitCustom('warning', { 
          message: "Limited results found, consider refining your query",
          resultsCount: results.length
        });
      }
      
      // Emit progress event - finalizing
      await events.emitProgress(95, "Finalizing deep search results");
      
      // Prepare and return output
      const output = {
        results,
        reasoning,
        usage: deepSearchResponse.usage || {
          modelName: "unknown",
          totalTokens: 0,
          promptTokens: 0,
          completionTokens: 0,
        }
      };
      
      // Emit completed event with result summary
      await events.emitCompleted({ 
        resultsCount: results.length,
        reasoning: !!reasoning,
        message: `Found ${results.length} results from deep search`
      });
      
      return output;
      
    } catch (error) {
      // Log the error
      console.error("Deep search step failed:", error);
      
      // Emit progress event - attempting fallback
      await events.emitProgress(60, "Primary search failed, attempting fallback search");
      
      // Attempt fallback to regular Jina search
      try {
        // Emit custom event for fallback
        await events.emitCustom('fallback', { 
          message: "Using fallback search mechanism",
          originalError: error.message
        });
        
        // Execute regular Jina search as fallback
        const fallbackResponse = await searchWithJina({
          query: inputData.query,
          maxResults: inputData.settings?.maxResults || 8,
        });
        
        // Emit progress event - processing fallback results
        await events.emitProgress(80, "Processing fallback search results");
        
        // Format fallback results
        const fallbackResults = fallbackResponse.results.map((result, index) => {
          return {
            url: result.url || "",
            title: result.title || `Result ${index + 1}`,
            snippet: result.content || result.snippet || "",
            highlights: result.highlights || [],
            source: result.source || new URL(result.url || "https://example.com").hostname,
            citationNumber: index + 1,
          };
        });
        
        // Emit custom event for fallback results
        await events.emitCustom('fallback-results', { 
          count: fallbackResults.length
        });
        
        // Emit completed event with fallback result summary
        await events.emitCompleted({ 
          resultsCount: fallbackResults.length,
          fallback: true,
          message: `Found ${fallbackResults.length} results using fallback search`
        });
        
        // Return fallback output
        return {
          results: fallbackResults,
          reasoning: "Search was performed using fallback mechanism due to an error with primary search.",
          usage: {
            modelName: "fallback",
            totalTokens: 0,
          }
        };
        
      } catch (fallbackError) {
        // Both primary and fallback search failed
        console.error("Fallback search also failed:", fallbackError);
        
        // Emit failed event with error details
        await events.emitFailed(
          "Failed to perform deep search", 
          { originalError: error.message, fallbackError: fallbackError.message }
        );
        
        // Return empty results with error info
        return {
          results: [],
          reasoning: "Search failed due to technical issues. Please try again later.",
          usage: {
            modelName: "error",
            totalTokens: 0,
          }
        };
      }
    }
  }
});

export default deepSearchStep;