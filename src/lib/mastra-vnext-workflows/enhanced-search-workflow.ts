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
  workflowOutput,
  contentProcessingInputSchema,
  contentProcessingOutputSchema
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
  contentProcessingStep,
  codeExecutionStep
} from '../mastra-vnext-steps';

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
 * Enhanced Q Search Workflow with E2B integration
 *
 * Extends the standard search workflow with content processing capabilities:
 * 1. Enhances user queries with planning and sub-questions
 * 2. Executes searches across multiple providers (Exa and Jina)
 * 3. Aggregates and deduplicates results
 * 4. Branches between DeepSearch (for complex queries) or traditional search paths
 * 5. Scrapes content from relevant web pages
 * 6. Processes and analyzes content with E2B
 * 7. Uses RAG to find the most relevant content
 * 8. Generates a final summary with citations
 */
export const enhancedSearchWorkflow = createWorkflow({
  id: 'enhanced-search-workflow',
  description: 'Comprehensive search workflow with content processing and analysis',
  inputSchema: userQueryInput,
  outputSchema: workflowOutput,
  steps: [
    planningAndQueryEnhancementStep,
    exaSearchStep,
    jinaSearchStep,
    deepSearchStep,
    aggregateAndDeduplicateSearchResultsStep,
    scrapeWebpageStep,
    contentProcessingStep,
    ragStep,
    summaryStep,
    codeExecutionStep
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
enhancedSearchWorkflow
  // Step 1: Planning and Query Enhancement (always executed first)
  .then(planningAndQueryEnhancementStep)
  // Branch based on query complexity
  .branch([
    // Complex query path: DeepSearch + Scraping
    [isComplexQueryCondition, deepSearchStep],
    // Standard query path: Parallel search providers + Aggregation
    [
      async ({ getStepResult }) => !await isComplexQueryCondition({ getStepResult }),
      enhancedSearchWorkflow
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
    return enhancedSearchWorkflow.parallel(
      input.urlsToScrape.map(item => ({
        step: scrapeWebpageStep,
        input: {
          targetUrl: item.url,
          originalQuery: enhancedSearchWorkflow.getInitData().query
        }
      }))
    );
  })
  // NEW STEP: Process and clean content with E2B
  .map(async ({ scrapedResults }) => {
    // Get the planning step output
    const planningOutput = enhancedSearchWorkflow.getStepResult(planningAndQueryEnhancementStep);
    
    // Prepare scraped content for processing
    const scrapedContents = Object.values(scrapedResults);
    
    // Process each scraped content in parallel
    return {
      processingTasks: scrapedContents.map((scraped: any, index) => ({
        content: scraped.content,
        options: {
          mode: 'clean', // Clean and standardize the content
          params: {
            originalQuery: planningOutput.enhancedQuery
          }
        },
        sourceInfo: {
          url: scraped.link,
          title: `Source ${index + 1}`
        }
      }))
    };
  })
  .then(input => {
    // Create parallel content processing tasks
    return enhancedSearchWorkflow.parallel(
      input.processingTasks.map((task, index) => ({
        step: contentProcessingStep,
        input: task
      }))
    );
  })
  // Step 5: Perform RAG on processed content
  .map(async ({ processedResults }) => {
    // Get the planning step output
    const planningOutput = enhancedSearchWorkflow.getStepResult(planningAndQueryEnhancementStep);
    
    // Extract the processed content from results
    const processedContents = Object.values(processedResults).map((result: any) => {
      // If processedContent is an array, join it; otherwise, use as is
      const content = Array.isArray(result.processedContent) 
        ? result.processedContent.join('\n\n')
        : result.processedContent;
      
      return {
        content,
        metadata: result.metadata || {},
        sourceInfo: result.sourceInfo
      };
    });
    
    // Return the input for RAG step
    return {
      scrapedContents: processedContents,
      enhancedQuery: planningOutput.enhancedQuery,
      subQuestions: planningOutput.subQuestions
    };
  })
  .then(ragStep)
  // Step 6: Generate the final summary
  .then(ragOutput => {
    // Get the planning step output
    const planningOutput = enhancedSearchWorkflow.getStepResult(planningAndQueryEnhancementStep);
    
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
    const { searchId } = enhancedSearchWorkflow.getInitData();
    
    // Get the planning step output for metadata
    const planningOutput = enhancedSearchWorkflow.getStepResult(planningAndQueryEnhancementStep);
    
    // Determine which search path was taken
    const isDeepSearch = !!enhancedSearchWorkflow.getStepResult(deepSearchStep);
    
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
enhancedSearchWorkflow.commit();

export default enhancedSearchWorkflow;