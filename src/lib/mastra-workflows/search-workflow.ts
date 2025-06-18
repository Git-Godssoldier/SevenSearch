import { z } from 'zod';
import { createWorkflow, createStep, isComplexQuery } from '../mastra-types';
import {
  UserQueryInputSchema,
  StreamChunkOutputSchema
} from '../mastra-schemas';

// Import all step implementations
import { planningAndQueryEnhancementStep } from '../mastra-steps/planning-query-enhancement-step';
import { firecrawlSearchStep } from '../mastra-steps/firecrawl-search-step';
import { jinaSearchStep } from '../mastra-steps/jina-search-step';
import { deepSearchStep } from '../mastra-steps/deep-search-step';
import { aggregateAndDeduplicateSearchResultsStep } from '../mastra-steps/aggregate-deduplicate-step';
import scrapeWebpageStep from '../mastra-steps/scrape-webpage-step';
import { generateEmbeddingsAndSemanticSearchStep } from '../mastra-steps/rag-step';
import summarizeContentStep from '../mastra-steps/summarize-content-step';

/**
 * Q Search Workflow
 *
 * This workflow orchestrates a comprehensive search process:
 * 1. Enhances user queries with planning and sub-questions
 * 2. Executes searches across multiple providers (Exa and Jina)
 * 3. Aggregates and deduplicates results
 * 4. Branches between DeepSearch (for complex queries) or traditional search paths
 * 5. Scrapes content from relevant web pages
 * 6. Uses RAG to find the most relevant content
 * 7. Generates a final summary with citations
 *
 * Features:
 * - Real-time streaming updates to client
 * - Error handling with graceful degradation
 * - Parallel execution of independent steps
 * - Intelligent branching based on query complexity
 */
export const qSearchWorkflow = createWorkflow({
  name: 'QSearchWorkflow',
  inputSchema: UserQueryInputSchema,
  outputSchema: z.object({
    summary: z.any(), // This will be a ReadableStream
    searchId: z.string(),
    metadata: z.record(z.string(), z.any()).optional()
  }),
  steps: {
    // Step 1: Planning and Query Enhancement
    planningStep: {
      step: planningAndQueryEnhancementStep,
      input: (ctx) => ({
        originalQuery: ctx.input.query,
      }),
      onComplete: async (ctx, output) => {
        // Send update to client
        ctx.context.pushUpdateToClient({
          step: 1,
          type: "planning_enhancing",
          payload: {
            enhancedQuery: output.enhancedQuery,
            subQuestions: output.subQuestions
          }
        });
      }
    },

    // Branch based on query complexity
    queryComplexityBranch: {
      dependencies: ['planningStep'],
      branch: (ctx) => {
        // Determine if the query is complex enough for DeepSearch
        return isComplexQuery(ctx.steps.planningStep.output.enhancedQuery) ? 'complex' : 'standard';
      },

      // Complex query path using DeepSearch
      branches: {
        complex: {
          deepSearch: {
            step: deepSearchStep,
            input: (ctx) => ({
              query: ctx.steps.planningStep.output.enhancedQuery,
            }),
            onComplete: async (ctx, output) => {
              ctx.context.pushUpdateToClient({
                step: 2,
                type: "searching",
                payload: {
                  method: "deep_search",
                  results: output.results.length,
                }
              });
            }
          },
          // Move straight to web scraping for DeepSearch results
          scrapeDeepSearchPages: {
            dependencies: ['deepSearch'],
            parallel: (ctx) =>
              ctx.steps.deepSearch.output.results.map((result, index) => ({
                step: scrapeWebpageStep,
                name: `scrape-deep-${index}`,
                input: {
                  targetUrl: result.url,
                  originalQuery: ctx.steps.planningStep.output.enhancedQuery,
                }
              }))
          }
        },

        // Standard query path using multiple search providers
        standard: {
          // Parallel search across multiple providers
          parallelSearch: {
            parallel: {
              firecrawl: {
                step: firecrawlSearchStep,
                input: (ctx) => ({
                  enhancedQuery: ctx.steps.planningStep.output.enhancedQuery,
                  subQuestions: ctx.steps.planningStep.output.subQuestions,
                  numResults: 5
                })
              },
              jina: {
                step: jinaSearchStep,
                input: (ctx) => ({
                  enhancedQuery: ctx.steps.planningStep.output.enhancedQuery,
                  subQuestions: ctx.steps.planningStep.output.subQuestions,
                  numResults: 5
                })
              }
            }
          },

          // Aggregate and deduplicate search results
          aggregateResults: {
            dependencies: ['parallelSearch'],
            step: aggregateAndDeduplicateSearchResultsStep,
            input: (ctx) => ({
              firecrawlResults: ctx.steps.parallelSearch.output.firecrawl,
              jinaResults: ctx.steps.parallelSearch.output.jina,
              planningOutput: ctx.steps.planningStep.output
            }),
            onComplete: async (ctx, output) => {
              ctx.context.pushUpdateToClient({
                step: 2,
                type: "searching_completed",
                payload: {
                  count: output.aggregatedResults.length,
                  sources: output.aggregatedResults.map(r => r.url)
                }
              });
            }
          },

          // Scrape pages from aggregated results
          scrapePages: {
            dependencies: ['aggregateResults'],
            parallel: (ctx) =>
              ctx.steps.aggregateResults.output.aggregatedResults
                .slice(0, 5) // Limit to top 5 results to control costs
                .map((result, index) => ({
                  step: scrapeWebpageStep,
                  name: `scrape-${index}`,
                  input: {
                    targetUrl: result.url,
                    originalQuery: ctx.steps.planningStep.output.enhancedQuery,
                  }
                }))
          }
        }
      }
    },

    // Join the branches together for RAG step
    ragStep: {
      dependencies: ['queryComplexityBranch'],
      step: generateEmbeddingsAndSemanticSearchStep,
      input: (ctx) => {
        // Collect all scraped content from either branch
        const scrapedContents = ctx.steps.queryComplexityBranch.branch === 'complex'
          ? ctx.steps.queryComplexityBranch.output.complex.scrapeDeepSearchPages.output
          : ctx.steps.queryComplexityBranch.output.standard.scrapePages.output;

        return {
          scrapedContents,
          enhancedQuery: ctx.steps.planningStep.output.enhancedQuery,
          subQuestions: ctx.steps.planningStep.output.subQuestions
        };
      }
    },

    // Generate final summary
    summarizeStep: {
      dependencies: ['ragStep', 'planningStep'],
      step: summarizeContentStep,
      input: (ctx) => ({
        relevantTexts: ctx.steps.ragStep.output.relevantTexts,
        planningOutput: ctx.steps.planningStep.output
      })
    }
  },

  // Error handling at workflow level
  onError: async (ctx, error) => {
    console.error("Workflow error:", error);
    ctx.context.pushUpdateToClient({
      step: 0,
      type: "error",
      payload: {
        message: error instanceof Error ? error.message : "Unknown workflow error"
      },
      error: true,
      errorType: error instanceof Error ? error.name : "Unknown"
    });

    // Create a simple error response
    const encoder = new TextEncoder();
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`
          <div class="answer-container">
            <h2 class="text-xl font-bold mb-4 text-red-600">Search Error</h2>
            <p class="mb-2">We encountered an error during your search: ${error instanceof Error ? error.message : "Unknown error"}</p>
            <p class="mb-2">Please try again with a different query or contact support if the issue persists.</p>
          </div>
        `));
        controller.close();
      }
    });

    return {
      summary: errorStream,
      searchId: ctx.input.searchId,
      metadata: {
        error: true,
        errorMessage: error instanceof Error ? error.message : "Unknown workflow error"
      }
    };
  },

  // Return final output from workflow
  output: (ctx) => ({
    summary: ctx.steps.summarizeStep.output.summary,
    searchId: ctx.input.searchId,
    metadata: {
      enhancedQuery: ctx.steps.planningStep.output.enhancedQuery,
      searchPath: ctx.steps.queryComplexityBranch.branch,
      generationComplete: ctx.steps.summarizeStep.output.generationComplete
    }
  })
});
