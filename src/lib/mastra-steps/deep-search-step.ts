import { z } from 'zod';
import { createStep, type WorkflowContext } from '../mastra-types';
import axios from 'axios';
import {
  UserQueryInputSchema,
  type StreamChunkOutputSchema,
  type IndividualSearchResultItemSchema
} from '../mastra-schemas';

// Define the specific output schema for DeepSearch results
const DeepSearchOutputSchema = z.object({
  results: z.array(z.object({
    url: z.string().url(),
    title: z.string().optional(),
    snippet: z.string().optional(),
    rawContent: z.string().optional(),
    score: z.number().optional(),
    provider: z.literal('JinaDeepSearch'),
    author: z.string().optional(),
    publishedDate: z.string().optional(),
    highlights: z.array(z.object({
      text: z.string(),
      score: z.number()
    })).optional(),
    citations: z.array(z.object({
      url: z.string(),
      title: z.string().optional(),
      snippet: z.string().optional()
    })).optional()
  })),
  reasoning: z.string().optional(),
  usage: z.object({
    prompt_tokens: z.number().optional(),
    completion_tokens: z.number().optional(),
    total_tokens: z.number().optional()
  }).optional()
});

/**
 * DeepSearch Step
 * 
 * Uses Jina's DeepSearch capability to find information across the web
 * for complex queries. This performs an AI-driven research process with
 * citations and reasoning.
 */
export const deepSearchStep = createStep({
  name: 'DeepSearchStep',
  inputSchema: UserQueryInputSchema,
  outputSchema: DeepSearchOutputSchema,
  async execute({ data, context }: { data: z.infer<typeof UserQueryInputSchema>, context: WorkflowContext }) {
    const { query } = data;
    const { JINA_API_KEY, pushUpdateToClient, searchId, userId } = context;
    
    console.log(`[MastraStep: ${this.name}] Started DeepSearch for searchId: ${searchId}, query: "${query}"`);
    
    // Update client that DeepSearch is starting
    pushUpdateToClient({
      step: 1,
      type: 'deepsearch_started',
      payload: { query }
    });
    
    // Jina DeepSearch API endpoint - uses Chat Completions format with a specialized model
    const JINA_DEEPSEARCH_API = 'https://api.jina.ai/v1/chat/completions';
    const headers = {
      'Authorization': `Bearer ${JINA_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-No-Cache': 'true',
      'X-Site': 'https://jina.ai'
    };
    
    try {
      // Prepare system prompt for DeepSearch model
      const systemPrompt = `You are a DeepSearch AI that provides comprehensive research with citations. 
For this query, search the web to find reliable information and provide:
1. A thorough, factual answer that fully addresses the query
2. Citations for every piece of information ([1], [2], etc.) linked to source URLs
3. Your reasoning about how you arrived at this information
4. Evaluation of source credibility

Format your response with:
- Main content with inline citations [1]
- <think>Your research reasoning and analysis process</think>
- Footnotes at the end: [^1]: URL "Title"`;

      // Call Jina DeepSearch API
      const response = await axios.post(
        JINA_DEEPSEARCH_API,
        {
          model: 'jina-deepsearch-v1',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: query
            }
          ],
          temperature: 0.2,
          max_tokens: 1500,
          top_p: 0.95,
          top_domains: ['.edu', '.gov', '.org'], // Prioritize educational, governmental, and organizational domains
          stream: false // We'll handle streaming at the workflow level
        },
        { headers }
      );
      
      // Validate response structure
      if (!response.data || !response.data.choices || !response.data.choices[0]) {
        throw new Error('Invalid response from Jina DeepSearch API');
      }
      
      const result = response.data.choices[0].message.content;
      const usage = response.data.usage;
      
      // Extract <think> sections for reasoning
      let reasoning = '';
      const thinkMatches = result.match(/<think>([\s\S]*?)<\/think>/g);
      if (thinkMatches) {
        reasoning = thinkMatches.join('\n').replace(/<\/?think>/g, '').trim();
      }
      
      // Parse citations from markdown footnotes
      const citationRegex = /\[\^(\d+)\]:\s*(https?:\/\/[^\s]+)(?:\s+"([^"]+)")?/g;
      const citations: any[] = [];
      let citationMatch;
      
      while ((citationMatch = citationRegex.exec(result)) !== null) {
        citations.push({
          url: citationMatch[2],
          title: citationMatch[3] || undefined,
          snippet: undefined // We don't have snippets in the citation format
        });
      }
      
      // Extract content without <think> sections and citation footnotes
      const cleanedContent = result
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/\[\^(\d+)\]:\s*https?:\/\/[^\s]+(?:\s+"[^"]+")?\s*/g, '');
      
      // If no citations found, try to extract URLs directly from the content
      if (citations.length === 0) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        let urlMatch;
        
        while ((urlMatch = urlRegex.exec(cleanedContent)) !== null) {
          citations.push({
            url: urlMatch[1],
            title: undefined,
            snippet: undefined
          });
        }
      }
      
      // If still no citations, return error for the client to handle
      if (citations.length === 0) {
        throw new Error('DeepSearch didn\'t return any citations or sources');
      }
      
      // Create results array for our schema
      const searchResults = citations.map(citation => ({
        url: citation.url,
        title: citation.title,
        snippet: cleanedContent.substring(0, 200), // Just a preview of the content
        rawContent: cleanedContent,
        score: 1, // DeepSearch doesn't provide individual scores
        provider: 'JinaDeepSearch' as const,
        author: undefined,
        publishedDate: undefined,
        highlights: [{ text: cleanedContent.substring(0, 300), score: 1 }],
        citations: [citation]
      }));
      
      console.log(`[MastraStep: ${this.name}] DeepSearch found ${searchResults.length} results`);
      
      // Update client that DeepSearch is completed
      pushUpdateToClient({
        step: 1,
        type: 'deepsearch_completed',
        payload: { 
          count: searchResults.length,
          reasoning: reasoning.substring(0, 200) + (reasoning.length > 200 ? '...' : ''),
          usage
        }
      });
      
      return {
        results: searchResults,
        reasoning,
        usage
      };
    } catch (error) {
      console.error(`[MastraStep: ${this.name}] Error in DeepSearch: `, error);
      
      // Update client about the error
      pushUpdateToClient({
        step: 1,
        type: 'error',
        payload: { 
          message: 'Failed to complete DeepSearch',
          error: error instanceof Error ? error.message : String(error)
        },
        error: true,
        errorType: 'deepsearch_error'
      });
      
      // Attempt to fall back to regular Jina Search as a last resort
      try {
        console.log(`[MastraStep: ${this.name}] Attempting fallback to regular Jina search`);
        
        const fallbackResponse = await axios.post(
          'https://api.jina.ai/v1/search',
          {
            query,
            limit: 5,
            type: 'web',
            include_content: true
          },
          {
            headers: {
              'Authorization': `Bearer ${JINA_API_KEY}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          }
        );
        
        if (fallbackResponse.data && fallbackResponse.data.results) {
          // Format as DeepSearch results
          const fallbackResults = fallbackResponse.data.results.map((result: any) => ({
            url: result.url,
            title: result.title || 'Untitled',
            snippet: result.snippet || (result.content ? result.content.substring(0, 200) : ''),
            rawContent: result.content,
            score: 1,
            provider: 'JinaDeepSearch' as const,
            author: undefined,
            publishedDate: undefined,
            highlights: result.highlights ? [{ 
              text: result.highlights[0] || '',
              score: 1 
            }] : undefined,
            citations: [{
              url: result.url,
              title: result.title,
              snippet: result.snippet
            }]
          }));
          
          pushUpdateToClient({
            step: 1,
            type: 'deepsearch_fallback',
            payload: { 
              count: fallbackResults.length,
              message: 'Using regular search results as fallback'
            }
          });
          
          return {
            results: fallbackResults,
            reasoning: `Failed to use DeepSearch, falling back to regular search results. Original error: ${error instanceof Error ? error.message : String(error)}`,
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
          };
        }
      } catch (fallbackError) {
        console.error(`[MastraStep: ${this.name}] Fallback search also failed: ${fallbackError}`);
      }
      
      // Return empty results as last resort
      return {
        results: [],
        reasoning: `Error during DeepSearch: ${error instanceof Error ? error.message : String(error)}`,
        usage: { total_tokens: 0 }
      };
    }
  }
});