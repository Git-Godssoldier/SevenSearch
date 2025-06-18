import { z } from 'zod';
import {
  planningAndQueryEnhancementStep,
  exaSearchStep,
  jinaSearchStep,
  deepSearchStep,
  aggregateAndDeduplicateSearchResultsStep,
  scrapeWebpageStep,
  generateEmbeddingsAndSemanticSearchStep,
  summarizeContentStep,
} from './mastra-steps';

/**
 * Interface for the StepContext in Mastra SDK
 */
export interface StepContext {
  [key: string]: any;
}

/**
 * Common workflow context interface for all steps
 */
export interface WorkflowContext extends StepContext {
  GEMINI_API_KEY?: string;
  SCRAPYBARA_API_KEY: string;
  EXA_API_KEY: string;
  FIRECRAWL_API_KEY?: string;
  JINA_API_KEY: string; // Jina AI API key for embeddings, reranker, and DeepSearch
  pushUpdateToClient: (update: any) => void;
  userId: string;
  searchId: string;
}

/**
 * Type for Step configuration in Mastra SDK
 */
export interface StepConfig<TInputSchema extends z.ZodType<any> = z.ZodType<any>, TOutputSchema extends z.ZodType<any> = z.ZodType<any>> {
  /** Unique name for the step */
  name: string;
  /** Zod schema for the step input */
  inputSchema: TInputSchema;
  /** Zod schema for the step output */
  outputSchema: TOutputSchema;
  /** Function that executes the step */
  execute: (params: {
    data: z.infer<TInputSchema>;
    context: WorkflowContext;
  }) => Promise<z.infer<TOutputSchema>>;
}

/**
 * Type for workflow configuration in Mastra SDK
 */
export interface WorkflowConfig<TInputSchema extends z.ZodType<any> = z.ZodType<any>, TOutputSchema extends z.ZodType<any> = z.ZodType<any>> {
  /** Unique name for the workflow */
  name: string;
  /** Zod schema for the workflow input */
  inputSchema: TInputSchema;
  /** Zod schema for the workflow output */
  outputSchema: TOutputSchema;
}

/**
 * Function to create a step in Mastra SDK v0.9.4-alpha.0
 */
export function createStep<
  TInputSchema extends z.ZodType<any> = z.ZodType<any>,
  TOutputSchema extends z.ZodType<any> = z.ZodType<any>
>(config: StepConfig<TInputSchema, TOutputSchema>) {
  return config;
}

/**
 * Helper function to check if a query is complex (requiring DeepSearch)
 */
export function isComplexQuery(query: string): boolean {
  // Check for indicators of a complex query
  const complexIndicators = [
    /why/i, /how/i, /explain/i, /what is/i, /what are/i, 
    /research/i, /compare/i, /difference/i, /analyze/i, /analysis/i,
    /comprehensive/i, /detailed/i, /thorough/i, /history of/i, /impact of/i, 
    /relationship between/i, /implications/i
  ];
  
  // Check for query length (longer queries tend to be more complex)
  const isLongQuery = query.split(' ').length > 7;
  
  // Check if any complex indicators are present
  const hasComplexIndicator = complexIndicators.some(pattern => pattern.test(query));
  
  // Return true if it's a long query or has complex indicators
  return isLongQuery || hasComplexIndicator;
}

/**
 * Function to create a workflow in Mastra SDK v0.9.4-alpha.0
 */
export function createWorkflow<
  TInputSchema extends z.ZodType<any> = z.ZodType<any>,
  TOutputSchema extends z.ZodType<any> = z.ZodType<any>
>(config: WorkflowConfig<TInputSchema, TOutputSchema>) {
  return {
    ...config,
    execute: async (input: z.infer<TInputSchema>, options?: { context?: WorkflowContext }) => {
      console.log(`Executing workflow ${config.name} with input:`, input);
      const context = options?.context;
      
      if (!context) {
        throw new Error("Context is required for workflow execution");
      }
      
      try {
        // Validate input against schema
        const validatedInput = config.inputSchema.parse(input);
        const query = validatedInput.query;
        
        // Decide whether to use DeepSearch or traditional search path
        if (isComplexQuery(query)) {
          console.log(`[Workflow: ${config.name}] Query identified as complex, using DeepSearch path`);
          context.pushUpdateToClient({
            step: 1,
            type: 'using_deepsearch',
            payload: { query, message: "Using AI-powered deep research for your complex query" }
          });
          
          // Execute DeepSearch step
          const deepSearchResult = await deepSearchStep.execute({
            data: validatedInput, 
            context
          });
          
          // Return the result with workflow metadata
          return {
            summary: deepSearchResult.summary || deepSearchResult,
            searchId: validatedInput.searchId,
            metadata: {
              workflow: config.name,
              completed_at: new Date().toISOString(),
              search_approach: "deep_search",
              enhancedQuery: query,
              sources: deepSearchResult.sources || []
            }
          } as any; // Type assertion needed due to schema differences
        } else {
          console.log(`[Workflow: ${config.name}] Query identified as standard, using traditional search path`);
          
          // First, enhance the query
          const planningResult = await planningAndQueryEnhancementStep.execute({
            data: { originalQuery: query },
            context
          });
          
          // Now run search in parallel for different providers
          const [exaResults, jinaResults] = await Promise.all([
            exaSearchStep.execute({
              data: { 
                enhancedQuery: planningResult.enhancedQuery,
                numResults: 5
              },
              context
            }).catch(error => {
              console.error(`[Workflow: ${config.name}] Error in exaSearchStep:`, error);
              return { searchProvider: 'Exa', results: [] };
            }),
            
            jinaSearchStep.execute({
              data: { 
                enhancedQuery: planningResult.enhancedQuery,
                numResults: 5
              },
              context
            }).catch(error => {
              console.error(`[Workflow: ${config.name}] Error in jinaSearchStep:`, error);
              return { searchProvider: 'Jina', results: [] };
            })
          ]);
          
          // Aggregate and deduplicate results
          const aggregatedResults = await aggregateAndDeduplicateSearchResultsStep.execute({
            data: {
              exaResults,
              jinaResults,
              planningOutput: planningResult
            },
            context
          });
          
          // Scrape content from top results
          const scrapingPromises = aggregatedResults.aggregatedResults.slice(0, 3).map(result => 
            scrapeWebpageStep.execute({
              data: {
                targetUrl: result.url,
                originalQuery: planningResult.enhancedQuery
              },
              context
            }).catch(error => {
              console.error(`[Workflow: ${config.name}] Error scraping ${result.url}:`, error);
              return { link: result.url, content: [], error: true };
            })
          );
          
          const scrapedContents = await Promise.all(scrapingPromises);
          
          // Generate embeddings and perform semantic search
          const relevantChunks = await generateEmbeddingsAndSemanticSearchStep.execute({
            data: {
              scrapedContents,
              enhancedQuery: planningResult.enhancedQuery,
              subQuestions: planningResult.subQuestions
            },
            context
          });
          
          // Generate final summary
          const summary = await summarizeContentStep.execute({
            data: {
              relevantChunks,
              planningOutput: planningResult
            },
            context
          });
          
          // Return the final result
          return {
            summary: summary.summary || summary,
            searchId: validatedInput.searchId,
            metadata: {
              workflow: config.name,
              completed_at: new Date().toISOString(),
              search_approach: "traditional_search",
              enhancedQuery: planningResult.enhancedQuery,
              sources: scrapedContents.map(content => content.link).filter(Boolean)
            }
          } as any; // Type assertion needed due to schema differences
        }
      } catch (error) {
        console.error(`[Workflow: ${config.name}] Execution error:`, error);
        throw error;
      }
    }
  };
}