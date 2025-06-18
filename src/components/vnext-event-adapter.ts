/**
 * vNext Event Adapter
 * 
 * Client-side utilities for processing vNext workflow events and converting them
 * to the format expected by the search results UI components.
 */

// Type definitions for UI components
export interface SearchStep {
  type: "enhancing" | "searching" | "reading" | "wrapping";
  content?: string;
  sources?: Array<{
    name: string;
    url: string;
  }>;
  enhancedQuery?: string;
  link?: string;
  contentBlocks?: number;
  summary?: string;
  error?: string;
  message?: string;
  enhancedQueryLoaded?: boolean;
  readingLinks?: Array<{
    name: string;
    url: string;
  }>;
  wrappingLoading?: boolean;
  streamUrl?: string;
}

export interface StreamChunk {
  step: number;
  type: string;
  payload: any;
  error?: boolean;
  errorType?: string;
}

export enum EventType {
  // Workflow Events
  WORKFLOW_STARTED = 'workflow_started',
  WORKFLOW_COMPLETED = 'workflow_completed',
  WORKFLOW_FAILED = 'workflow_failed',
  
  // Step Events
  ENHANCING_RUNNING = 'enhancing_running',
  ENHANCING_COMPLETED = 'enhancing_completed',
  SEARCHING_RUNNING = 'searching_running',
  SEARCHING_COMPLETED = 'searching_completed',
  READING_RUNNING = 'reading_running',
  READING_COMPLETED = 'reading_completed',
  READING_UPDATE = 'reading_update',
  WRAPPING_RUNNING = 'wrapping_running',
  WRAPPING_COMPLETED = 'wrapping_completed',
  
  // Progress Events
  PROGRESS_UPDATE = 'progress_update',
  
  // Error Events
  ERROR = 'error',
  
  // Link Events
  LINK_SCRAPED = 'link_scraped',
  
  // Search Events
  RESULTS_FOUND = 'results_found',
  BRANCH_SELECTED = 'branch_selected',
}

/**
 * Process a stream chunk to update the UI state
 */
export function processStreamChunk(
  chunk: StreamChunk,
  currentSteps: SearchStep[],
  setSteps: (steps: SearchStep[]) => void,
  currentStep: number,
  setCurrentStep: (step: number) => void,
  enhancedQuery: string | null,
  setEnhancedQuery: (query: string | null) => void,
  setResult: (result: string | null) => void,
  setAnswerLoading: (loading: boolean) => void,
  setShowAnswer: (show: boolean) => void,
  receivedStep4: React.MutableRefObject<boolean>,
  setError: (error: { type: string; message: string } | null) => void
): void {
  try {
    // Handle error messages from the server
    if (chunk.error) {
      setError({
        type: chunk.errorType || "unknown",
        message: chunk.payload?.message || "An unexpected error occurred."
      });
      
      // Handle specific error types
      if (chunk.errorType === "invalid_api_key" || chunk.errorType === "authentication_failed") {
        // Error is already handled by setting the error state
        return;
      }
      
      return; // Stop processing the stream on error
    }

    // Process events based on step numbers and types
    switch (chunk.step) {
      case 0: // Workflow level events
        if (chunk.type === EventType.WORKFLOW_STARTED) {
          // Initialization already done, nothing to do here
        }
        break;
        
      case 1: // Enhancing query step
        if (chunk.type.includes('enhancing')) {
          // Set enhanced query if available
          if (chunk.payload?.enhancedQuery) {
            setEnhancedQuery(chunk.payload.enhancedQuery);
            
            // Update or create the enhancing step
            const updatedSteps = [...currentSteps];
            const enhancingStepIndex = updatedSteps.findIndex(step => step.type === 'enhancing');
            
            if (enhancingStepIndex !== -1) {
              updatedSteps[enhancingStepIndex] = {
                ...updatedSteps[enhancingStepIndex],
                enhancedQuery: chunk.payload.enhancedQuery,
                enhancedQueryLoaded: true,
              };
            } else {
              updatedSteps.push({
                type: 'enhancing',
                enhancedQuery: chunk.payload.enhancedQuery,
                enhancedQueryLoaded: true,
              });
            }
            
            setSteps(updatedSteps);
            setCurrentStep(0);
          }
        }
        break;
        
      case 2: // Search step
        // Handle search-related events
        if (chunk.type.includes('searching') || chunk.type === EventType.BRANCH_SELECTED || chunk.type === EventType.RESULTS_FOUND) {
          setSteps(prev => {
            const searchingStepIndex = prev.findIndex(step => step.type === 'searching');
            
            if (searchingStepIndex !== -1) {
              // Update existing searching step
              return prev.map((step, index) => 
                index === searchingStepIndex
                  ? { 
                      ...step, 
                      message: chunk.payload.message || "Searching for information", 
                      streamUrl: chunk.payload.streamUrl 
                    }
                  : step
              );
            } else {
              // Add new searching step
              return [
                ...prev,
                {
                  type: 'searching',
                  message: chunk.payload.message || "Searching initiated",
                  streamUrl: chunk.payload.streamUrl
                }
              ];
            }
          });
          
          setCurrentStep(1);
        }
        break;
        
      case 3: // Reading step
        if (chunk.type.includes('reading') || chunk.type === EventType.READING_UPDATE || chunk.type === EventType.LINK_SCRAPED) {
          // Update reading step with link information
          const newReadingLink = chunk.payload.link || chunk.payload.url;
          
          if (newReadingLink) {
            setSteps(prev => {
              const existingReadingLinks = prev.find(step => step.type === 'reading')?.readingLinks || [];
              const newReadingLinks = [
                ...existingReadingLinks,
                {
                  name: `Source ${existingReadingLinks.length + 1}`,
                  url: newReadingLink,
                }
              ];
              
              const readingStepIndex = prev.findIndex(step => step.type === 'reading');
              
              if (readingStepIndex !== -1) {
                // Update existing reading step
                return prev.map((step, index) =>
                  index === readingStepIndex
                    ? {
                        ...step,
                        readingLinks: newReadingLinks,
                        contentBlocks: chunk.payload.contentBlocks || chunk.payload.contentCount,
                        error: chunk.payload.error,
                      }
                    : step
                );
              } else {
                // Add new reading step
                return [
                  ...prev,
                  {
                    type: 'reading',
                    readingLinks: newReadingLinks,
                    contentBlocks: chunk.payload.contentBlocks || chunk.payload.contentCount,
                    error: chunk.payload.error,
                  }
                ];
              }
            });
            
            setCurrentStep(2);
          }
        }
        break;
        
      case 4: // Wrapping step (RAG)
        // No specific handling needed for RAG step
        break;
        
      case 5: // Summary step
        if (!receivedStep4.current) {
          receivedStep4.current = true;
          setCurrentStep(3);
          
          setSteps(prev => {
            const wrappingIndex = prev.findIndex(step => step.type === 'wrapping');
            const loading = chunk.payload?.loading !== false;
            
            if (wrappingIndex === -1) {
              // Add the wrapping step
              return [...prev, {
                type: 'wrapping',
                wrappingLoading: loading,
                summary: loading ? undefined : chunk.payload?.summary
              }];
            } else {
              // Update existing wrapping step
              return prev.map((step, index) =>
                index === wrappingIndex
                  ? {
                      ...step,
                      wrappingLoading: loading,
                      summary: loading ? undefined : chunk.payload?.summary
                    }
                  : step
              );
            }
          });
          
          setShowAnswer(true);
        } else {
          // Update existing wrapping step
          setSteps(prev => {
            const wrappingIndex = prev.findIndex(step => step.type === 'wrapping');
            const loading = chunk.payload?.loading !== false;
            
            if (wrappingIndex !== -1) {
              return prev.map((step, index) =>
                index === wrappingIndex
                  ? {
                      ...step,
                      wrappingLoading: loading,
                      summary: loading ? step.summary : chunk.payload?.summary
                    }
                  : step
              );
            }
            return prev;
          });
        }
        
        // Update answer loading state and content
        if (chunk.payload?.summary) {
          setResult(chunk.payload.summary);
        }
        
        setAnswerLoading(chunk.payload?.loading !== false);
        break;
        
      default:
        // Default case for unknown step numbers
        console.warn("Unknown step:", chunk.step);
    }
  } catch (error) {
    console.error("Error processing stream chunk:", error, chunk);
  }
}

/**
 * Process a stream chunk from the raw text format
 */
export function parseStreamChunk(
  part: string
): StreamChunk | null {
  if (!part) return null;
  
  try {
    return JSON.parse(part) as StreamChunk;
  } catch (error) {
    console.error("Error parsing stream chunk:", error, part);
    return null;
  }
}

/**
 * Create an error object from a stream chunk
 */
export function createErrorFromChunk(
  chunk: StreamChunk
): { type: string; message: string } {
  return {
    type: chunk.errorType || "unknown",
    message: chunk.payload?.message || "An unexpected error occurred."
  };
}