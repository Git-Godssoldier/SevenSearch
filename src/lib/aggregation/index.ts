import { Step, WorkflowContext } from '../mastra';
import { SearchResult } from '../mastra/types';

export class AggregationStep implements Step {
  getName(): string {
    return 'aggregation';
  }

  async execute(context: WorkflowContext): Promise<void> {
    const exaResults = context.get('exaResults') || [];
    const firecrawlResults = context.get('firecrawlResults') || [];

    const allResults = [...exaResults, ...firecrawlResults];

    const uniqueResults = this.deduplicateResults(allResults);

    const rankedResults = this.rankResults(uniqueResults);

    context.set('aggregatedResults', rankedResults);
  }

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const uniqueUrls = new Set<string>();
    return results.filter(result => {
      const normalizedUrl = result.url.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
      if (!uniqueUrls.has(normalizedUrl)) {
        uniqueUrls.add(normalizedUrl);
        return true;
      }
      return false;
    });
  }

  private rankResults(results: SearchResult[]): SearchResult[] {
    // For now, we'll just return the results in the order they were received.
    // A more sophisticated ranking algorithm will be implemented later.
    return results;
  }
}
