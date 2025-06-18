import { Step, WorkflowContext } from '../mastra';
import { SearchResult } from '../mastra/types';
import Exa from 'exa-js';
import { CacheProvider, MemoryCache } from '../cache';
import { RateLimitManager } from '../rate-limiter';
import { SearchProviderFactory, providerRegistry } from './index';

export class ExaSearchStep implements Step {
  private apiKey: string
  private cache: CacheProvider
  private rateLimiter: RateLimitManager

  constructor(
    apiKey: string,
    cache?: CacheProvider,
    rateLimiter?: RateLimitManager
  ) {
    this.apiKey = apiKey
    this.cache = cache || new MemoryCache()
    this.rateLimiter = rateLimiter || new RateLimitManager()
  }

  getName(): string {
    return 'exa-search';
  }

  async execute(context: WorkflowContext): Promise<void> {
    const query = context.get('query')
    const cacheKey = `exa-search-${query}`
    const cachedResults = await this.cache.get(cacheKey)

    if (cachedResults) {
      context.set('exaResults', cachedResults)
      return
    }

    if (!(await this.rateLimiter.checkLimit('exa', 10, 60000))) {
      console.log('Exa rate limit exceeded. Skipping for now.')
      return
    }

    const exa = new Exa(this.apiKey)
    const results = await exa.search(query, {
      numResults: 10,
      type: 'neural',
    })

    const searchResults: SearchResult[] = results.results.map(
      (result: any) => ({
        title: result.title,
        url: result.url,
        snippet: result.text,
        source: 'Exa',
      })
    )

    await this.cache.set(cacheKey, searchResults);
    context.set('exaResults', searchResults);
  }
}

class ExaSearchProviderFactory implements SearchProviderFactory {
  createStep(config: Record<string, any>): Step {
    return new ExaSearchStep(config.apiKey);
  }

  getName(): string {
    return 'exa';
  }

  getDefaultConfig(): Record<string, any> {
    return { apiKey: process.env.EXA_API_KEY || '' };
  }
}

providerRegistry.registerProvider(new ExaSearchProviderFactory());
