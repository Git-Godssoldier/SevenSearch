import { z } from 'zod';
import { createStep } from '@mastra/core/workflows';
import { EventStreamWriter } from '../mastra-vnext-utils/stream-events';
import { EventEmitter } from 'events';

/**
 * Search result schema for human review
 */
export const searchResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  snippet: z.string().optional(),
});

/**
 * Human review input schema
 */
export const humanReviewInputSchema = z.object({
  searchResults: z.array(searchResultSchema),
  query: z.string(),
  enhancedQuery: z.string().optional(),
  userMessage: z.string().optional(), // Optional message to display to user
});

/**
 * Suspend schema - data sent to client during workflow suspension
 */
export const humanReviewSuspendSchema = z.object({
  searchResults: z.array(searchResultSchema),
  query: z.string(),
  enhancedQuery: z.string().optional(),
  suggestedSelection: z.array(z.number()), // Suggested indices to select
  userMessage: z.string().optional(), // Message to show the user
  suspendedAt: z.string(), // ISO timestamp
});

/**
 * Resume schema - data received from client to resume workflow
 */
export const humanReviewResumeSchema = z.object({
  selectedResultIndices: z.array(z.number()), // Indices of results selected by user
  additionalInstructions: z.string().optional(), // Any extra instructions from user
  resumedAt: z.string(), // ISO timestamp
});

/**
 * Human review output schema
 */
export const humanReviewOutputSchema = z.object({
  selectedResults: z.array(searchResultSchema),
  additionalInstructions: z.string().optional(),
  userSelection: z.boolean(), // True if user made selection, false if using defaults
});

/**
 * Human Review Step
 * 
 * Allows human intervention during the search workflow by suspending
 * execution and waiting for user input before continuing.
 */
export const humanReviewStep = createStep({
  id: 'human-review',
  description: 'Pauses workflow for human input on search results',
  inputSchema: humanReviewInputSchema,
  outputSchema: humanReviewOutputSchema,
  suspendSchema: humanReviewSuspendSchema,
  resumeSchema: humanReviewResumeSchema,
  
  async execute({ 
    inputData, 
    resumeData, 
    suspend, 
    emitter, 
    runtimeContext 
  }) {
    const events = EventStreamWriter.createStepEventHelpers(
      emitter as unknown as EventEmitter, 
      'human-review'
    );
    
    // Get the search ID from runtime context
    const { searchId } = runtimeContext.getAll();
    
    console.log(`[Step: human-review] Processing for searchId: ${searchId}`);
    
    // If this is an initial execution (not resumed)
    if (!resumeData) {
      try {
        await events.emitRunning({ 
          searchResultCount: inputData.searchResults.length,
          query: inputData.query 
        });
  
        // Select top results as suggestions based on relevance scoring
        // For simplicity, we're suggesting top 3 results, but this could be more sophisticated
        const suggestedSelection = [0, 1, 2].filter(i => i < inputData.searchResults.length);
        
        console.log(`[Step: human-review] Suspending workflow for user review - searchId: ${searchId}`);
        
        // Emit a custom event to notify the client about the suspension
        await events.emitCustom('workflow_suspending', {
          reason: 'human_review_required',
          searchId,
          timestamp: new Date().toISOString()
        });
        
        // Suspend workflow and wait for human input
        await suspend({
          searchResults: inputData.searchResults,
          query: inputData.query,
          enhancedQuery: inputData.enhancedQuery,
          suggestedSelection,
          userMessage: inputData.userMessage || 'Please select the most relevant search results to include in your answer:',
          suspendedAt: new Date().toISOString()
        });
        
        // Execution pauses here until resumed with human input
        return null;
      } catch (error) {
        console.error(`[Step: human-review] Error suspending workflow:`, error);
        
        await events.emitFailed(
          'Failed to suspend workflow for human review',
          error instanceof Error ? error.message : String(error)
        );
        
        // Fall back to default selection (top 3 results)
        const defaultSelection = inputData.searchResults.slice(0, 3);
        
        return {
          selectedResults: defaultSelection,
          additionalInstructions: '',
          userSelection: false
        };
      }
    }
    
    try {
      // Process resumed data with human selections
      console.log(`[Step: human-review] Workflow resumed with user selections - searchId: ${searchId}`);
      
      await events.emitRunning({ 
        searchResultCount: inputData.searchResults.length,
        selectedCount: resumeData.selectedResultIndices.length,
        resumedAt: resumeData.resumedAt 
      });
      
      // Map selected indices to actual result objects
      const selectedResults = resumeData.selectedResultIndices.map(
        index => inputData.searchResults[index]
      ).filter(Boolean); // Filter out any undefined values (in case of invalid indices)
      
      // If no valid selections were made, use the top 3 results as a fallback
      const finalSelectedResults = selectedResults.length > 0
        ? selectedResults
        : inputData.searchResults.slice(0, Math.min(3, inputData.searchResults.length));
      
      // Emit completion event
      await events.emitCompleted({
        selectedResultCount: finalSelectedResults.length,
        hasAdditionalInstructions: !!resumeData.additionalInstructions
      });
      
      // Return the user selections
      return {
        selectedResults: finalSelectedResults,
        additionalInstructions: resumeData.additionalInstructions,
        userSelection: selectedResults.length > 0 // True if user made valid selections
      };
    } catch (error) {
      console.error(`[Step: human-review] Error processing resumed data:`, error);
      
      await events.emitFailed(
        'Failed to process user selections',
        error instanceof Error ? error.message : String(error)
      );
      
      // Fall back to default selection (top 3 results)
      const defaultSelection = inputData.searchResults.slice(0, 3);
      
      return {
        selectedResults: defaultSelection,
        additionalInstructions: '',
        userSelection: false
      };
    }
  },
});

export default humanReviewStep;