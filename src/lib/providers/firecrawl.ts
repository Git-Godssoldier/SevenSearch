import { Step, WorkflowContext } from '../mastra';
import { SearchResult } from '../mastra/types';
import FirecrawlApp from '@mendable/firecrawl-js';
import { CacheProvider, MemoryCache } from '../cache';
import { RateLimitManager } from '../rate-limiter';
import { SearchProviderFactory, providerRegistry } from './index';

export class FirecrawlSearchStep implements Step {
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
    return 'firecrawl-search';
  }

  async execute(context: WorkflowContext): Promise<void> {
    const query = context.get('query')
    const cacheKey = `firecrawl-search-${query}`
    const cachedResults = await this.cache.get(cacheKey)

    if (cachedResults) {
      context.set('firecrawlResults', cachedResults)
      return
    }

    if (!(await this.rateLimiter.checkLimit('firecrawl', 10, 60000))) {
      console.log('Firecrawl rate limit exceeded. Skipping for now.')
      return
    }

    const app = new FirecrawlApp({ apiKey: this.apiKey })
    const results = await app.search(query, {
      pageOptions: {
        fetchPageContent: true,
      },
    })

    const searchResults: SearchResult[] = results.data.map((result: any) => ({
      title: result.metadata.title,
      url: result.url,
      snippet: result.raw_content,
      source: 'Firecrawl',
    }))

    await this.cache.set(cacheKey, searchResults);
    context.set('firecrawlResults', searchResults);
  }
}

class FirecrawlSearchProviderFactory implements SearchProviderFactory {
  createStep(config: Record<string, any>): Step {
    return new FirecrawlSearchStep(config.apiKey);
  }

  getName(): string {
    return 'firecrawl';
  }

  getDefaultConfig(): Record<string, any> {
    return { apiKey: process.env.FIRECRAWL_API_KEY || '' };
  }
}

providerRegistry.registerProvider(new FirecrawlSearchProviderFactory());
