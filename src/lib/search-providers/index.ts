/**
 * Search Providers
 * 
 * This module exports all available search providers for Project Gargantua.
 */

export { exaSearchProvider } from './exa-provider';
export { 
  jinaSearchProvider,
  searchWithJina,
  searchWithJinaDeepSearch
} from './jina-provider';

// Common provider interface
export interface SearchProvider {
  search: (
    query: string, 
    options?: Record<string, any>
  ) => Promise<{
    title: string;
    url: string;
    snippet?: string;
    source: string;
    confidence?: number;
    relevance?: number;
    metadata?: Record<string, any>;
  }[]>;
}

// Provider factory type
export type SearchProviderFactory = (apiKey: string) => SearchProvider;