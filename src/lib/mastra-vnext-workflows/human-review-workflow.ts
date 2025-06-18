import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Import vNext schemas
import {
  userQueryInput,
  planningOutput,
  workflowOutput,
} from '../mastra-vnext-schemas';

// Import vNext steps
import {
  planningAndQueryEnhancementStep,
  exaSearchStep,
  jinaSearchStep,
  aggregateAndDeduplicateSearchResultsStep,
  humanReviewStep,
  ragStep,
  summaryStep,
} from '../mastra-vnext-steps';

/**
 * Human Review Workflow
 * 
 * This workflow demonstrates human-in-the-loop capabilities by:
 * 1. Processing a user's search query
 * 2. Enhancing it with planning and sub-questions
 * 3. Executing searches across multiple providers
 * 4. Aggregating and deduplicating results
 * 5. Requesting human input on which search results to use
 * 6. Using RAG to process selected content
 * 7. Generating a final summary response
 */
export const humanReviewWorkflow = createWorkflow({
  id: 'human-review-workflow',
  description: 'Search workflow with human review of results',
  inputSchema: userQueryInput,
  outputSchema: workflowOutput,
  steps: [
    planningAndQueryEnhancementStep,
    exaSearchStep,
    jinaSearchStep,
    aggregateAndDeduplicateSearchResultsStep,
    humanReviewStep,
    ragStep,
    summaryStep,
  ],
  retryConfig: {
    attempts: 1,  // Don't retry steps that fail
    delay: 1000   // Wait 1 second between retries if needed
  }
});

// Define the workflow execution flow
humanReviewWorkflow
  // Step 1: Planning and Query Enhancement
  .then(planningAndQueryEnhancementStep)
  
  // Step 2: Execute parallel search with Exa and Jina
  .parallel([exaSearchStep, jinaSearchStep])
  
  // Step 3: Aggregate and deduplicate search results
  .then(aggregateAndDeduplicateSearchResultsStep)
  
  // Step 4: Human review of search results
  .then(aggregateResults => {
    // Prepare input for human review step
    return {
      searchResults: aggregateResults.aggregatedResults.slice(0, 10),
      query: humanReviewWorkflow.getInitData().query,
      enhancedQuery: humanReviewWorkflow.getStepResult(planningAndQueryEnhancementStep)?.enhancedQuery
    };
  })
  .then(humanReviewStep)
  
  // Step 5: RAG on selected results
  .then(humanReviewOutput => {
    // Get the planning step output
    const planningResult = humanReviewWorkflow.getStepResult(planningAndQueryEnhancementStep);
    
    // Prepare for RAG with only selected results
    return {
      scrapedContents: humanReviewOutput.selectedResults.map(result => ({
        content: result.snippet || '',
        metadata: {},
        sourceInfo: {
          url: result.url,
          title: result.title
        }
      })),
      enhancedQuery: planningResult?.enhancedQuery || humanReviewWorkflow.getInitData().query,
      subQuestions: planningResult?.subQuestions || [],
      additionalInstructions: humanReviewOutput.additionalInstructions
    };
  })
  .then(ragStep)
  
  // Step 6: Generate final summary
  .then(ragOutput => {
    // Get the planning step output
    const planningOutput = humanReviewWorkflow.getStepResult(planningAndQueryEnhancementStep);
    
    // Prepare for summary generation
    return {
      relevantTexts: ragOutput.relevantTexts,
      planningOutput: planningOutput,
      // Include additional instructions if provided during human review
      additionalInstructions: humanReviewWorkflow.getStepResult(humanReviewStep)?.additionalInstructions
    };
  })
  .then(summaryStep)
  
  // Final output mapping
  .map(summaryOutput => {
    // Get the original search ID
    const { searchId } = humanReviewWorkflow.getInitData();
    
    // Get the planning step output for metadata
    const planningOutput = humanReviewWorkflow.getStepResult(planningAndQueryEnhancementStep);
    const humanReviewOutput = humanReviewWorkflow.getStepResult(humanReviewStep);
    
    // Return the final workflow output
    return {
      summary: summaryOutput.summary,
      searchId,
      metadata: {
        enhancedQuery: planningOutput?.enhancedQuery || '',
        searchPath: 'human_reviewed',
        generationComplete: summaryOutput.generationComplete,
        userSelected: humanReviewOutput?.userSelection || false
      }
    };
  });

// Finalize the workflow definition
humanReviewWorkflow.commit();

export default humanReviewWorkflow;