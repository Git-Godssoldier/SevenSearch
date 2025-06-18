import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { StreamingTextResponse } from '@/lib/utils/streaming';
import type { Session } from "next-auth";

// Gargantua orchestration system imports
import { createOrchestrationSystem } from '@/lib/mastra-vnext-utils/orchestration-system';
import { createTaskManager } from '@/lib/mastra-vnext-utils/task-management';
import { EventStreamWriter } from '@/lib/mastra-vnext-utils/stream-events';

// Search provider implementations
import { exaSearchProvider } from '@/lib/search-providers/exa-provider';
import { jinaSearchProvider } from '@/lib/search-providers/jina-provider';

// Define a more specific type for the session object based on usage
interface AppSession extends Session {
  user: {
    id: string;
    apiKey?: string | null; // Scrapybara API Key from user session
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

/**
 * Project Gargantua API Route
 * 
 * This API route implements the advanced search capabilities of Project Gargantua
 * with task management, workflow orchestration, and planning search. It handles:
 * - Authentication and session validation
 * - Setting up the orchestration system
 * - Task tracking and to-do list maintenance
 * - Dynamic workflow adaptation based on query analysis
 * - Streaming events back to the client during execution
 * - Error handling and timeout management
 * - Storing results and workflow state in Supabase
 */
export async function POST(request: Request) {
  try {
    const { query, searchId } = await request.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Check authentication with fallback to mock user ID for auth failures
    let user_id = "mock-user-id-12345"; // Default mock ID
    let userApiKey = process.env.SCRAPYBARA_API_KEY || ""; // Default from env
    
    try {
      const session = await auth() as AppSession | null;
      if (session && session.user && session.user.id) {
        user_id = session.user.id;
        userApiKey = session.user.apiKey || userApiKey;
      } else {
        console.log("[Gargantua API] Authentication failed, using mock user ID");
      }
    } catch (authError) {
      console.error("[Gargantua API] Authentication error:", authError);
      // Continue with mock user ID
    }

    // Validate required API keys before starting
    const missingKeys = [];
    if (!process.env.GEMINI_API_KEY) missingKeys.push('GEMINI_API_KEY');
    if (!userApiKey && !process.env.SCRAPYBARA_API_KEY) missingKeys.push('SCRAPYBARA_API_KEY');
    if (!process.env.EXA_API_KEY) missingKeys.push('EXA_API_KEY');
    if (!process.env.JINA_API_KEY) missingKeys.push('JINA_API_KEY');

    // Create a TransformStream for better backpressure handling in Edge environment
    const { readable, writable } = new TransformStream();
    const streamWriter = new EventStreamWriter(writable);

    // Launch a separate async function to process the workflow and write to the stream
    (async () => {
      try {
        console.log(`[Gargantua API] Starting search workflow for query: "${query}", searchId: ${searchId}`);

        // Check for missing API keys and handle early if needed
        if (missingKeys.length > 0) {
          const errorMessage = `Missing required API keys: ${missingKeys.join(', ')}`;
          console.error(`[Gargantua API] ${errorMessage}`);
          await streamWriter.sendError(errorMessage, 'missing_api_keys');
          await streamWriter.close();
          return;
        }

        // Send initial workflow started event
        await streamWriter.sendWorkflowStarted(query, searchId);

        // Initialize the orchestration system
        const orchestrationSystem = createOrchestrationSystem(
          searchId,
          user_id,
          query
        );

        // Register search providers
        orchestrationSystem.registerSearchProvider({
          name: 'exa',
          provider: exaSearchProvider(process.env.EXA_API_KEY!),
          enabled: true
        });

        orchestrationSystem.registerSearchProvider({
          name: 'jina',
          provider: jinaSearchProvider(process.env.JINA_API_KEY!),
          enabled: true
        });

        // Register agents
        orchestrationSystem.registerAgent({
          id: 'planning-agent',
          model: 'gemini-1.5-flash',
          description: 'Agent for query planning and enhancement',
          provider: 'gemini',
          enabled: true,
          tools: ['search', 'analyze']
        });

        orchestrationSystem.registerAgent({
          id: 'research-agent',
          model: 'claude-3-5-sonnet',
          description: 'Agent for deep research and information gathering',
          provider: 'anthropic',
          enabled: true,
          tools: ['search', 'browse', 'analyze']
        });

        try {
          // Create a timeout promise to handle long-running workflows
          const timeoutPromise = new Promise<null>((_, reject) => {
            setTimeout(() => {
              reject(new Error('Workflow execution timed out after 120 seconds'));
            }, 120000); // 2 minute timeout
          });

          // Race the workflow execution against the timeout
          await Promise.race([
            orchestrationSystem.startSearch(),
            timeoutPromise
          ]);

          // Store results in Supabase for future retrieval
          try {
            console.log('[Gargantua API] Storing results in Supabase...');

            // Get planning result for metadata
            const planningResult = orchestrationSystem.getWorkflowOrchestrator().getPlanningResult();
            
            // Store in Supabase
            const { data, error } = await supabase
              .from('searches')
              .upsert({
                searchId,
                user_id,
                query,
                enhanced_query: planningResult.enhancedQuery || query,
                sources: JSON.stringify([]), // Streaming, so sources will be updated later
                summary: "Generated with Project Gargantua - see client", 
                completed: true,
                completed_at: new Date().toISOString(),
                search_approach: planningResult.searchStrategy || 'standard'
              });

            if (error) {
              console.error('[Gargantua API] Error storing results in Supabase:', error);
            } else {
              console.log('[Gargantua API] Results stored in Supabase successfully');
            }
          } catch (storageError) {
            console.error('[Gargantua API] Error storing results in Supabase:', storageError);
            // Non-fatal error, continue to send the result to the client
          }
        } catch (error) {
          console.error('[Gargantua API] Error in orchestration system:', error);
          const errorMessage = error instanceof Error ? error.message : "Unknown workflow execution error";
          const isTimeout = errorMessage.includes('timed out');

          await streamWriter.sendError(
            isTimeout
              ? "Search took too long to complete. Try a more specific query."
              : `Workflow execution failed: ${errorMessage}`,
            isTimeout ? 'timeout_error' : 'workflow_execution_error'
          );
        }
      } catch (error) {
        console.error('[Gargantua API] Critical error in stream processing:', error);

        try {
          await streamWriter.sendError(
            "Critical stream processing error",
            'stream_error'
          );
        } catch (writeError) {
          console.error('[Gargantua API] Failed to write error to stream:', writeError);
        }
      } finally {
        // Always ensure we close the stream writer properly
        await streamWriter.close();
      }
    })().catch(err => {
      console.error('[Gargantua API] Unhandled error in async stream processor:', err);
    });

    // Return the readable stream immediately - processing continues asynchronously
    return new StreamingTextResponse(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  } catch (err) {
    console.error("[Gargantua API] Critical error in POST handler:", err);
    return NextResponse.json({ error: "Something went wrong in the API handler" }, { status: 500 });
  }
}