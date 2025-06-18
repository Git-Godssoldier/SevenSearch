/**
 * Jina AI search provider for Mastra vNext workflows
 */
import { z } from 'zod';

export interface JinaSearchConfig {
  apiKey: string;
  endpoint?: string;
  maxResults?: number;
  timeout?: number;
}

export interface JinaSearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  score: number;
  source: string;
  metadata?: {
    [key: string]: any;
  };
}

export interface JinaSearchResponse {
  results: JinaSearchResult[];
  totalResults: number;
  searchTime: number;
  queryId: string;
  metadata?: {
    [key: string]: any;
  };
}

export const jinaSearchConfigSchema = z.object({
  apiKey: z.string().min(1),
  endpoint: z.string().url().optional(),
  maxResults: z.number().min(1).max(100).optional(),
  timeout: z.number().min(1000).max(60000).optional(),
});

export const jinaSearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
  snippet: z.string(),
  score: z.number(),
  source: z.string(),
  metadata: z.record(z.any()).optional(),
});

export const jinaSearchResponseSchema = z.object({
  results: z.array(jinaSearchResultSchema),
  totalResults: z.number(),
  searchTime: z.number(),
  queryId: z.string(),
  metadata: z.record(z.any()).optional(),
});

export type ValidatedJinaSearchConfig = z.infer<typeof jinaSearchConfigSchema>;
export type ValidatedJinaSearchResult = z.infer<typeof jinaSearchResultSchema>;
export type ValidatedJinaSearchResponse = z.infer<typeof jinaSearchResponseSchema>;

export default class JinaSearchProvider {
  private config: ValidatedJinaSearchConfig;
  private searchEndpoint: string;
  
  constructor(config: JinaSearchConfig) {
    this.config = jinaSearchConfigSchema.parse(config);
    this.searchEndpoint = this.config.endpoint || 'https://api.jina.ai/v1/search';
  }
  
  async search(query: string): Promise<JinaSearchResponse> {
    try {
      const response = await fetch(this.searchEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          query,
          maxResults: this.config.maxResults || 10
        }),
        signal: this.config.timeout 
          ? AbortSignal.timeout(this.config.timeout)
          : undefined
      });
      
      if (!response.ok) {
        throw new Error(`Jina search failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return jinaSearchResponseSchema.parse(data);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Jina search error: ${error.message}`);
      }
      throw error;
    }
  }
}

/**
 * Search with Jina API (for use in deep search steps)
 */
export async function searchWithJina(
  query: string, 
  config: JinaSearchConfig
): Promise<JinaSearchResult[]> {
  const provider = new JinaSearchProvider(config);
  const response = await provider.search(query);
  return response.results;
}

/**
 * Perform deep search with Jina AI
 */
export async function searchWithJinaDeepSearch(
  query: string,
  config: JinaSearchConfig,
  options?: {
    maxRetries?: number;
    retryDelay?: number;
  }
): Promise<JinaSearchResult[]> {
  const maxRetries = options?.maxRetries || 3;
  const retryDelay = options?.retryDelay || 1000;
  
  let currentTry = 0;
  let lastError: Error | null = null;
  
  while (currentTry < maxRetries) {
    try {
      const provider = new JinaSearchProvider(config);
      const response = await provider.search(query);
      
      // Add deep search metadata
      const resultsWithMetadata = response.results.map(result => ({
        ...result,
        metadata: {
          ...result.metadata,
          deepSearch: true,
          deepSearchLevel: currentTry + 1
        }
      }));
      
      return resultsWithMetadata;
    } catch (error) {
      currentTry++;
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Wait before retrying
      if (currentTry < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  throw lastError || new Error('Deep search failed with unknown error');
}