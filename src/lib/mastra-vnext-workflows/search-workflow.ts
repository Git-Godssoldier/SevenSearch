import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Import vNext schemas
import {
  userQueryInput,
  planningOutput,
  webScrapingInput,
  webScrapingOutput,
  ragInput,
  ragOutput,
  summaryInput,
  summaryOutput,
  workflowOutput
} from '../mastra-vnext-schemas';

// Import vNext steps
import {
  planningAndQueryEnhancementStep,
  exaSearchStep,
  jinaSearchStep,
  aggregateAndDeduplicateSearchResultsStep,
  scrapeWebpageStep,
  ragStep,
  deepSearchStep,
  summaryStep,
} from '../mastra-vnext-steps';

// Note: We're now using the native vNext implementation of the DeepSearch step

// Note: We're now using the native vNext implementation of the Summary step

/**
 * Helper function to create an error stream
 */
function createErrorStream(errorMessage: string): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`
        <div class="answer-container">
          <h2 class="text-xl font-bold mb-4 text-red-600">Search Error</h2>
          <p class="mb-2">We encountered an error during your search: ${errorMessage}</p>
          <p class="mb-2">Please try again with a different query or contact support if the issue persists.</p>
        </div>
      `));
      controller.close();
    }
  });
}

/**
 * Q Search Workflow using vNext API
 *
 * Orchestrates a comprehensive search process:
 * 1. Enhances user queries with planning and sub-questions
 * 2. Executes searches across multiple providers (Exa and Jina)
 * 3. Aggregates and deduplicates results
 * 4. Branches between DeepSearch (for complex queries) or traditional search paths
 * 5. Scrapes content from relevant web pages
 * 6. Uses RAG to find the most relevant content
 * 7. Generates a final summary with citations
 */
export const qSearchWorkflow = createWorkflow({
  id: 'q-search-workflow',
  description: 'Comprehensive search workflow with multi-provider results',
  inputSchema: userQueryInput,
  outputSchema: workflowOutput,
  steps: [
    planningAndQueryEnhancementStep,
    exaSearchStep,
    jinaSearchStep,
    deepSearchStep,
    aggregateAndDeduplicateSearchResultsStep,
    scrapeWebpageStep,
    ragStep,
    summaryStep
  ],
  retryConfig: {
    attempts: 2,   // Retry failed steps up to 2 times
    delay: 1000    // Wait 1 second between retries
  }
});

// Define the complex query branch condition
const isComplexQueryCondition = async ({ getStepResult }) => {
  const planningResult = getStepResult(planningAndQueryEnhancementStep);
  if (!planningResult) return false;
  
  const { enhancedQuery } = planningResult;
  
  // Check for indicators of a complex query
  const complexIndicators = [
    /why/i, /how/i, /explain/i, /what is/i, /what are/i, 
    /research/i, /compare/i, /difference/i, /analyze/i, /analysis/i,
    /comprehensive/i, /detailed/i, /thorough/i, /history of/i, /impact of/i, 
    /relationship between/i, /implications/i
  ];
  
  // Check for query length (longer queries tend to be more complex)
  const isLongQuery = enhancedQuery.split(' ').length > 7;
  
  // Check if any complex indicators are present
  const hasComplexIndicator = complexIndicators.some(pattern => pattern.test(enhancedQuery));
  
  // Return true if it's a long query or has complex indicators
  return isLongQuery || hasComplexIndicator;
};

// Define the workflow execution flow
qSearchWorkflow
  // Step 1: Planning and Query Enhancement (always executed first)
  .then(planningAndQueryEnhancementStep)
  // Branch based on query complexity
  .branch([
    // Complex query path: DeepSearch + Scraping
    [isComplexQueryCondition, deepSearchStep],
    // Standard query path: Parallel search providers + Aggregation
    [
      async ({ getStepResult }) => !await isComplexQueryCondition({ getStepResult }),
      qSearchWorkflow
        .parallel([exaSearchStep, jinaSearchStep])
        .then(aggregateAndDeduplicateSearchResultsStep)
    ]
  ])
  // The rest of the workflow depends on which branch was taken
  .map(async ({ getStepResult }) => {
    // Check which branch was executed
    const deepSearchOutput = getStepResult(deepSearchStep);
    const aggregationOutput = getStepResult(aggregateAndDeduplicateSearchResultsStep);
    
    if (deepSearchOutput) {
      // DeepSearch path was taken
      return { 
        results: deepSearchOutput.results,
        isDeepSearch: true
      };
    } else if (aggregationOutput) {
      // Standard search path was taken
      return { 
        results: aggregationOutput.aggregatedResults,
        isDeepSearch: false
      };
    }
    
    // Fallback (should never happen)
    return {
      results: [],
      isDeepSearch: false
    };
  })
  // Step 4: Scrape relevant web pages
  .map(async ({ inputData }) => {
    const { results } = inputData;
    
    // Limit to top 5 results to control costs
    const topResults = results.slice(0, 5);
    
    // Return the results for parallel scraping
    return {
      urlsToScrape: topResults.map(result => ({ 
        url: result.url,
        title: result.title || ''
      }))
    };
  })
  .then(input => {
    // Create parallel scraping tasks
    return qSearchWorkflow.parallel(
      input.urlsToScrape.map(item => ({
        step: scrapeWebpageStep,
        input: {
          targetUrl: item.url,
          originalQuery: qSearchWorkflow.getInitData().query
        }
      }))
    );
  })
  // Step 5: Perform RAG on scraped content
  .then(scrapedResults => {
    // Get the planning step output
    const planningOutput = qSearchWorkflow.getStepResult(planningAndQueryEnhancementStep);
    
    // Return the input for RAG step
    return {
      scrapedContents: Object.values(scrapedResults),
      enhancedQuery: planningOutput.enhancedQuery,
      subQuestions: planningOutput.subQuestions
    };
  })
  .then(ragStep)
  // Step 6: Generate the final summary
  .then(ragOutput => {
    // Get the planning step output
    const planningOutput = qSearchWorkflow.getStepResult(planningAndQueryEnhancementStep);
    
    // Return the input for summary step
    return {
      relevantTexts: ragOutput.relevantTexts,
      planningOutput: planningOutput
    };
  })
  .then(summaryStep)
  // Final output mapping
  .map(summaryOutput => {
    // Get the original search ID
    const { searchId } = qSearchWorkflow.getInitData();
    
    // Get the planning step output for metadata
    const planningOutput = qSearchWorkflow.getStepResult(planningAndQueryEnhancementStep);
    
    // Determine which search path was taken
    const isDeepSearch = !!qSearchWorkflow.getStepResult(deepSearchStep);
    
    // Return the final workflow output
    return {
      summary: summaryOutput.summary,
      searchId,
      metadata: {
        enhancedQuery: planningOutput.enhancedQuery,
        searchPath: isDeepSearch ? 'complex' : 'standard',
        generationComplete: summaryOutput.generationComplete
      }
    };
  });

// Finalize the workflow definition
qSearchWorkflow.commit();

export default qSearchWorkflow;