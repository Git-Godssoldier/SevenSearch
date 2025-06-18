import { z } from 'zod';
import { createStep } from '../mastra-vnext-utils/step';
import { EventStreamWriter } from '../mastra-vnext-utils/stream-events';
import { TransformStream } from 'stream/web';
import { TextEncoder } from 'util';

// Schema definitions
const summaryInputSchema = z.object({
  relevantTexts: z.array(z.string()).nonempty(),
  planningOutput: z.object({
    enhancedQuery: z.string(),
    subQuestions: z.array(z.string()).optional(),
    plan: z.string().optional(),
  }),
  format: z.enum(['markdown', 'html']).optional().default('html'),
  maxLength: z.number().optional(),
  includeCitations: z.boolean().optional().default(true),
});

const summaryOutputSchema = z.object({
  summary: z.instanceof(ReadableStream),
  generationComplete: z.boolean(),
});

/**
 * Creates a stream of HTML content for the summary
 */
function createSummaryStream(content: string, format: 'markdown' | 'html' = 'html'): ReadableStream {
  const encoder = new TextEncoder();
  
  if (format === 'html') {
    // Wrap content in HTML structure for rendering
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`
          <div class="answer-container">
            <div class="answer-content">
              ${content}
            </div>
          </div>
        `));
        controller.close();
      }
    });
  } else {
    // Return raw markdown 
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(content));
        controller.close();
      }
    });
  }
}

/**
 * Stream generator for LLM responses
 */
function createStreamingTransformer(
  emitter: EventEmitter,
  stepId: string,
  startEvent: any = {}
): TransformStream<Uint8Array, Uint8Array> {
  const encoder = new TextEncoder();
  let buffer = '';
  let lastProgressUpdate = Date.now();
  let totalChunks = 0;
  const events = EventStreamWriter.createStepEventHelpers(emitter, stepId);
  
  // Report progress every 500ms
  const PROGRESS_INTERVAL = 500;
  
  // Emit initial running status
  events.emitRunning(startEvent);
  
  return new TransformStream({
    async transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk);
      buffer += text;
      totalChunks++;
      
      // Pass through the chunk
      controller.enqueue(chunk);
      
      // Report progress periodically
      const now = Date.now();
      if (now - lastProgressUpdate > PROGRESS_INTERVAL) {
        lastProgressUpdate = now;
        await events.emitProgress(
          Math.min(95, Math.floor(25 + (totalChunks / 20) * 70)), // Estimate progress 25%-95%
          "Generating summary..."
        );
        
        // Also emit a custom event with the latest buffer content
        await events.emitCustom('summary_progress', {
          chunkCount: totalChunks,
          recentText: buffer.substring(buffer.length - 100) // Last 100 chars
        });
      }
    },
    async flush(controller) {
      // Emit final progress
      await events.emitProgress(100, "Summary generation complete");
      
      // Emit completion event
      await events.emitCompleted({
        message: "Summary generated successfully",
        chunkCount: totalChunks,
        contentLength: buffer.length
      });
    }
  });
}

/**
 * Native vNext Summary Step
 * 
 * Generates a comprehensive summary from relevant texts using an LLM.
 * Supports streaming to provide real-time updates to the client.
 */
export const summaryStep = createStep({
  id: 'summary-step',
  name: 'Summary Generation',
  description: 'Creates a comprehensive answer from relevant texts with citations',
  inputSchema: summaryInputSchema,
  outputSchema: summaryOutputSchema,
  
  async execute({ inputData, runtimeContext, emitter }) {
    const events = EventStreamWriter.createStepEventHelpers(emitter, 'summary-step');
    
    try {
      // Extract inputs
      const { relevantTexts, planningOutput, format = 'html', maxLength, includeCitations = true } = inputData;
      const { enhancedQuery, subQuestions = [], plan = '' } = planningOutput;
      
      // Get relevant configuration from context
      const { modelName, apiKey, searchId } = runtimeContext.getAll();
      
      // Emit initial running status
      await events.emitRunning({
        message: "Starting summary generation",
        textCount: relevantTexts.length,
        format
      });
      
      // Emit progress update
      await events.emitProgress(10, "Analyzing content for summary");
      
      // Create content for the summary prompt
      const combinedTexts = relevantTexts.slice(0, 10).join('\n\n---\n\n');
      
      // Extract the search query for the prompt
      const query = enhancedQuery || 'Generate a comprehensive answer';
      
      // Emit progress update before starting the LLM call
      await events.emitProgress(20, "Preparing to generate summary");
      
      // Custom event for summary preparation
      await events.emitCustom('summary_preparation', {
        textCount: relevantTexts.length,
        format,
        query
      });
      
      // Emit progress update
      await events.emitProgress(25, "Starting summary generation");
      
      try {
        // In this implementation, we'll create a mock stream for demonstration
        // In a real implementation, you would:
        // 1. Call your LLM service with streaming enabled
        // 2. Pipe the LLM response through the transformer
        // 3. Return the transformed stream
        
        // Mock implementation for testing the events and UI
        const summaryContent = `
          <h2>Answer Summary</h2>
          <p>Based on the provided texts, here is a comprehensive answer to your query about "${query}":</p>
          <p>The analysis of multiple sources indicates that there are several key points to consider...</p>
          ${
            includeCitations 
              ? '<p>According to <a href="#citation-1" data-citation="1">[1]</a>, further research suggests...</p>' 
              : '<p>Further research suggests...</p>'
          }
          <p>In conclusion, the evidence supports that...</p>
          ${
            includeCitations 
              ? '<div class="citations"><h3>Citations</h3><ol><li id="citation-1">First source, retrieved from example.com</li></ol></div>' 
              : ''
          }
        `;
        
        // Create the base stream with the content
        const baseStream = createSummaryStream(summaryContent, format);
        
        // Create the transformer that will handle progress updates
        const transformer = createStreamingTransformer(
          emitter, 
          'summary-step', 
          { 
            message: "Generating summary in real-time", 
            format 
          }
        );
        
        // Create the final stream by piping through the transformer
        const transformedStream = baseStream.pipeThrough(transformer);
        
        // Return the result
        return { 
          summary: transformedStream,
          generationComplete: true
        };
        
      } catch (streamError) {
        console.error("Error during summary stream generation:", streamError);
        
        // Emit failure for the streaming specifically
        await events.emitCustom('stream_error', {
          error: streamError.message,
          phase: 'streaming'
        });
        
        // Create an error stream as fallback
        const errorContent = `
          <div class="error-container">
            <h2 class="text-xl font-bold mb-4 text-red-600">Summary Generation Error</h2>
            <p class="mb-2">We encountered an error while generating your summary: ${streamError.message}</p>
            <p class="mb-2">Please try again or simplify your query.</p>
          </div>
        `;
        
        // Return error content in a stream
        return {
          summary: createSummaryStream(errorContent, 'html'),
          generationComplete: false
        };
      }
      
    } catch (error) {
      console.error("Summary step failed:", error);
      
      // Emit failed event
      await events.emitFailed(
        "Failed to generate summary", 
        error instanceof Error ? error.message : "Unknown error"
      );
      
      // Return an error stream
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      const errorContent = `
        <div class="error-container">
          <h2 class="text-xl font-bold mb-4 text-red-600">Summary Generation Error</h2>
          <p class="mb-2">We encountered an error: ${errorMessage}</p>
          <p class="mb-2">Please try again with a different query.</p>
        </div>
      `;
      
      return {
        summary: createSummaryStream(errorContent, 'html'),
        generationComplete: false
      };
    }
  }
});

export default summaryStep;