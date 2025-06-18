import { NextResponse } from "next/server";
import {
  EventStreamWriter,
  EventType
} from '@/lib/mastra-vnext-utils';

// Use Node.js runtime for auth compatibility
// TODO: Convert to Edge Runtime once auth is removed
export const runtime = 'nodejs';

// Add comprehensive error handling and logging
const DEBUG_MODE = process.env.NODE_ENV === 'development' || process.env.DEBUG_ENHANCE_SEARCH === 'true';

// Validate environment to prevent circular dependency issues
function validateEnvironment() {
  try {
    // Basic environment validation
    if (typeof process === 'undefined') {
      throw new Error('Process object not available');
    }

    if (DEBUG_MODE) {
      console.log('[API Route] Environment validation passed');
    }

    return true;
  } catch (envError) {
    console.error('[API Route] Environment validation failed:', envError);
    return false;
  }
}

// Safe auth helper that doesn't cause circular dependencies
async function getSafeUserId(): Promise<string> {
  try {
    // Try to get user ID from auth, but don't fail if it's not available
    const { getAuthenticatedUserId } = await import('@/lib/utils/api-helpers');
    return await getAuthenticatedUserId();
  } catch (authError) {
    if (DEBUG_MODE) {
      console.warn("[API Route] Auth not available, using mock user:", authError);
    }
    return "mock-user-id-12345";
  }
}

// Simplified streaming implementation for Edge Runtime compatibility
export async function POST(request: Request) {
  try {
    // Validate environment first
    if (!validateEnvironment()) {
      console.error("[API Route] Environment validation failed");
      return NextResponse.json({
        error: "Server configuration error"
      }, { status: 500 });
    }

    if (DEBUG_MODE) {
      console.log("[API Route] POST request received");
    }

    const { query, searchId } = await request.json();

    if (!query) {
      console.error("[API Route] Missing query parameter");
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    if (DEBUG_MODE) {
      console.log(`[API Route] Processing query: "${query}" with searchId: ${searchId}`);
    }

    // Determine user ID using safe auth helper (for future use)
    const user_id = await getSafeUserId();

    if (DEBUG_MODE) {
      console.log(`[API Route] Using user ID: ${user_id}`);
    }

    const stream = new ReadableStream({
      async start(controller) {
        // Create a proper WritableStream for EventStreamWriter
        const writableStream = new WritableStream({
          write(chunk) {
            controller.enqueue(chunk);
          },
          close() {
            controller.close();
          },
          abort(reason) {
            controller.error(reason);
          }
        });

        const writer = new EventStreamWriter(writableStream);

        try {
          console.log(`[API Route] Starting workflow for query: "${query}" with searchId: ${searchId}`);

          // Send initial workflow started event
          await writer.sendWorkflowStarted(query, searchId);

          // For now, create a comprehensive test response to verify streaming works
          // TODO: Fix the actual workflow execution once Mastra API is properly configured

          console.warn('[API Route] Using test implementation - workflow execution needs proper configuration');

          // Send realistic test events to verify the streaming pipeline
          await writer.sendManualUpdate(1, 'enhancing_running', {
            description: 'Enhancing your search query...',
            stepId: 'planning-query-enhancement'
          });

          await new Promise(resolve => setTimeout(resolve, 800));

          await writer.sendManualUpdate(1, 'enhancing_completed', {
            description: 'Query enhancement completed',
            stepId: 'planning-query-enhancement',
            enhancedQuery: `Enhanced: ${query}`,
            enhancedQueryLoaded: true
          });

          await new Promise(resolve => setTimeout(resolve, 500));

          await writer.sendManualUpdate(2, 'searching_running', {
            description: 'Searching multiple sources...',
            stepId: 'exa-search'
          });

          await new Promise(resolve => setTimeout(resolve, 1000));

          await writer.sendManualUpdate(2, 'searching_completed', {
            description: 'Search completed',
            stepId: 'exa-search',
            resultCount: 5,
            provider: 'exa'
          });

          await new Promise(resolve => setTimeout(resolve, 500));

          await writer.sendManualUpdate(3, 'reading_running', {
            description: 'Reading and analyzing sources...',
            stepId: 'scrape-webpage'
          });

          await new Promise(resolve => setTimeout(resolve, 1200));

          await writer.sendManualUpdate(3, 'reading_update', {
            description: 'Content analysis in progress',
            stepId: 'scrape-webpage',
            link: 'https://example.com/source1',
            contentBlocks: 3
          });

          await new Promise(resolve => setTimeout(resolve, 800));

          await writer.sendManualUpdate(5, 'wrapping_running', {
            description: 'Synthesizing information...',
            stepId: 'summary-step'
          });

          await new Promise(resolve => setTimeout(resolve, 1000));

          // Create a comprehensive test result
          const result = {
            summary: `Based on your search for "${query}", here's what I found:

This is a test response demonstrating the streaming functionality. The actual search workflow needs to be properly configured with the Mastra framework.

Key findings:
• The streaming pipeline is working correctly
• Events are being processed and sent to the client
• The EventStreamWriter is functioning as expected
• The API route is handling requests properly

Next steps:
1. Configure the actual Mastra workflow execution
2. Set up proper search providers (Exa, Jina)
3. Implement content scraping and RAG processing
4. Add real-time event handling from workflow steps

This test confirms that the infrastructure is ready for the full implementation.`,
            searchId: searchId,
            metadata: {
              enhancedQuery: `Enhanced: ${query}`,
              searchPath: 'test_implementation',
              generationComplete: true,
              testMode: true
            }
          };

          console.log(`[API Route] Workflow completed successfully:`, result);

          // Send workflow completion event
          await writer.sendWorkflowCompleted(searchId, result);

        } catch (error) {
          console.error('[API Route] Workflow execution error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown workflow error';
          await writer.sendError(errorMessage, 'workflow_error');
        } finally {
          console.log('[API Route] Closing stream writer');
          await writer.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    console.error("[API Route] Critical error in POST handler:", err);
    return NextResponse.json({ error: "Something went wrong in the API handler" }, { status: 500 });
  }
}
