# Implementation Plan: Resolving Vercel Streaming API Issue

## 1. Problem Statement

The Scrpexity application's streaming API, which provides search results, functions correctly in the local development environment but fails on Vercel deployment. Specifically, only the first chunk of the streamed response is delivered to the client, after which the stream terminates prematurely.

**Reference from `README.md`**: "The project's streaming API will only receive the first response in vercel then stop because my dumbass wrote streaming API enqueue but Vercel only accepts edge cases, but works fine in local development."

**Relevant Files**:
- Likely `src/app/api/search/route.ts` or `src/app/api/enhance-search/route.ts` (to be confirmed by code review).
- The project uses the Vercel AI SDK (`ai` package).

## 2. Background Research & Known Constraints (from Perplexity & IRMS)

- **Vercel Edge Runtime**: Edge Functions run in a specialized environment, not a full Node.js environment. They use Web Standard APIs.
- **`ReadableStream` API**: This is the standard API for creating streams. Proper management of the stream lifecycle (enqueueing, closing, error handling) is critical.
- **Chunk Encoding**: Data chunks must be properly encoded (e.g., using `TextEncoder`) before being enqueued.
- **Buffer Management & Flow Control**: Issues can arise if multiple chunks are enqueued rapidly without proper backpressure or flow control, potentially leading to merged or lost chunks.
- **Error Handling**: Unhandled errors or promise rejections within the stream's `start`, `pull`, or `cancel` methods can cause the stream to break.
- **Vercel Edge Function Limitations**:
    - Max execution duration.
    - Max payload size (25MB for responses).
    - Differences in API support compared to Node.js.
- **Vercel AI SDK**: This SDK provides helpers for streaming AI responses, often using `ReadableStream` and `TransformStream`. Its specific patterns and requirements must be adhered to.

## 3. Diagnostic Steps

### 3.1. Confirm the Exact API Route
   - **Action**: Review `src/app/search/[id]/page.tsx` or related client-side components to identify which API endpoint (`/api/search` or `/api/enhance-search`) is responsible for fetching and displaying the streamed search results.
   - **Goal**: Pinpoint the server-side code to investigate.

### 3.2. Detailed Logging in Vercel
   - **Action**: Add extensive `console.log` statements within the identified API route on the Vercel deployment.
     - Log entry into the function.
     - Log before and after each `controller.enqueue()` call.
     - Log when `controller.close()` is called.
     - Log any caught errors within `try...catch` blocks.
     - Log the content and type of data being enqueued.
   - **Tool**: Vercel Dashboard Logs.
   - **Goal**: Understand where the stream execution stops or if any errors are silently occurring on Vercel.

### 3.3. Simplify the Streamed Data
   - **Action**: Temporarily modify the API route to stream very simple, static string data instead of complex AI-generated content.
     ```typescript
     // Example of simplified stream for testing
     const stream = new ReadableStream({
       start(controller) {
         const encoder = new TextEncoder();
         controller.enqueue(encoder.encode("Chunk 1\n"));
         console.log("Enqueued Chunk 1");
         setTimeout(() => {
           controller.enqueue(encoder.encode("Chunk 2\n"));
           console.log("Enqueued Chunk 2");
           controller.enqueue(encoder.encode("Chunk 3 - Final\n"));
           console.log("Enqueued Chunk 3");
           controller.close();
           console.log("Stream closed");
         }, 500); // Add slight delay to simulate async work
       }
     });
     return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
     ```
   - **Goal**: Isolate whether the issue is with the streaming mechanism itself or the data being processed/streamed.

### 3.4. Review Vercel AI SDK Usage
   - **Action**: Carefully review the parts of the code that use the Vercel AI SDK (`StreamingTextResponse`, `LangchainStream`, `OpenAIStream`, etc.).
   - **Reference**: Vercel AI SDK documentation for best practices in Edge Functions.
   - **Goal**: Ensure the SDK is used correctly within the constraints of Vercel Edge Runtime. Pay attention to how the underlying `ReadableStream` is created and managed by the SDK.

### 3.5. Check for Asynchronous Operations and Promises
    - **Action**: Ensure all asynchronous operations within the stream generation logic are correctly `await`ed or chained with `.then()`, and that any promise rejections are caught.
    - **Goal**: Prevent unhandled promise rejections from breaking the stream.

## 4. Potential Solutions & Implementation Strategies

Based on diagnostics, one or more of the following may be necessary:

### 4.1. Refactor Stream Management
   - **If `enqueue` method is problematic**:
     - Ensure the `controller` is not closed prematurely.
     - Ensure data is enqueued correctly (e.g., `TextEncoder().encode(string)` for text).
     - Consider using a `TransformStream` if complex data manipulation is needed before enqueueing, as it can offer better flow control.
   - **Example using `TransformStream` (conceptual)**:
     ```typescript
     let sourceClosed = false;
     const transformStream = new TransformStream({
       async transform(chunk, controller) {
         // Process chunk if needed
         controller.enqueue(encoder.encode(processedChunk));
       },
       flush(controller) {
         if (sourceClosed) {
            controller.terminate();
         }
       }
     });
     // pipe your source stream to transformStream.writable
     // return new Response(transformStream.readable)
     ```

### 4.2. Ensure Proper Stream Closure
   - **Action**: Double-check that `controller.close()` is always called when the stream is finished, and only once. If an error occurs, ensure the stream is properly terminated or errored.
   - **Vercel AI SDK**: If using helpers like `StreamingTextResponse`, they usually handle this. If constructing streams manually, this is crucial.

### 4.3. Incremental Data Fetching and Enqueueing
   - **Action**: If large amounts of data are processed before the first enqueue, or between enqueues, refactor to process and enqueue smaller pieces of data more frequently.
   - **Goal**: Avoid hitting Vercel's execution time limits for a single "processing step" within the stream.

### 4.4. Explicit Error Handling in Stream
   - **Action**: Wrap stream logic in `try...catch` blocks and use `controller.error(err)` if an error occurs that should terminate the stream and signal an error to the client.
     ```typescript
     const stream = new ReadableStream({
       async start(controller) {
         try {
           // ... your streaming logic ...
           controller.enqueue(encoder.encode("data"));
           // ...
           controller.close();
         } catch (e) {
           console.error("Stream error:", e);
           controller.error(e); // Signal error to the client
         }
       }
     });
     ```

### 4.5. Review Next.js and Vercel AI SDK Versions
    - **Action**: Check for known issues with the specific versions of `next` and `ai` being used. Consider upgrading if a relevant bug fix is available in a newer version.
    - **Tool**: GitHub Issues for Next.js and Vercel AI SDK. (Note: GitHub MCP was unavailable for this step).

### 4.6. Alternative Streaming Approach (if Vercel AI SDK is the issue)
    - **Action**: If the Vercel AI SDK's stream helpers are suspected, try implementing a more basic stream using `ReadableStream` directly for a small part of the data to see if it behaves differently.

## 5. Testing and Validation

- **Local First**: Ensure any changes work perfectly in the local environment (`bun run dev`).
- **Vercel Deployment**: Deploy changes to a Vercel preview deployment for testing.
- **Client-Side Consumption**: Verify that the client correctly receives and processes all chunks of the stream. Check browser console for errors.
- **Network Tab**: Use the browser's network tab to inspect the streaming response.

## 6. Contingency / Fallback (if immediate fix is elusive)

- If fixing the stream on Vercel Edge proves too complex immediately, consider temporarily:
    - Switching the API route from `runtime: 'edge'` to the default Node.js serverless runtime on Vercel (if functionality allows and performance degradation is acceptable for a short period). This would involve removing `export const config = { runtime: 'edge' };`.
    - Implementing a non-streaming version that sends the full response once processed, with a loading indicator on the client. This is a temporary measure to restore functionality.

## 7. Documentation & Next Steps (Post-Fix)

- Document the root cause and the fix in `irms.md` and potentially `README.md`.
- Proceed with other TODO items: webhooks, UI glitches, rate limiting, and Mastra vNext integration.

## 8. Integrating Mastra vNext Workflows as Core Orchestrator

This section outlines a plan to refactor the existing search and enhancement logic to use Mastra vNext workflows, while retaining Scrapybara's web scraping capabilities.

### 8.1. Goals
- Improve modularity, maintainability, and observability of the multi-agent search system.
- Leverage Mastra's type-safe schemas, composable steps, and execution patterns (sequential, parallel, conditional).
- Encapsulate Scrapybara calls and other agent logic within Mastra steps.
- Ensure the streaming of results to the frontend is maintained, potentially by having the final Mastra workflow step output a stream compatible with Vercel AI SDK or a direct `ReadableStream`.

### 8.2. Mastra vNext Concepts (Enhanced with Documentation Insights)
- **Schemas**: Zod-based input/output validation for each step, ensuring type safety and data integrity throughout the workflow. (Source: Mastra Docs Overview)
- **Steps**: Atomic, reusable units of operation. Can encapsulate LLM calls, tool usage (like Scrapybara), custom logic, or even other workflows. Steps support suspension and resumption with context preservation. (Source: Mastra Docs Overview)
  ```typescript
  // Example Mastra Step
  import { z } from 'zod';
  import { createStep } from '@mastra/core'; // Assuming this is the package

  const exampleInputSchema = z.object({ message: z.string() });
  const exampleOutputSchema = z.object({ reply: z.string() });

  const exampleStep = createStep({
    name: "exampleProcessor",
    inputSchema: exampleInputSchema,
    outputSchema: exampleOutputSchema,
    // 'context' here would be the RuntimeContext
    execute: async ({ data, context }) => { 
      // Perform some action with data.message
      // Access workflow-level context via context.workflow.context
      return { reply: `Processed: ${data.message}` };
    }
  });
  ```
- **Workflows**: Composable orchestrations of steps. vNext Workflows use `.then()` for sequential execution, `.parallel()` for parallel tasks, and `.branch()` for conditional logic. The `.after()` command has been removed. (Source: Mastra Releases via Perplexity Search)
- **RuntimeContext**: The former `Container` is now `RuntimeContext` in vNext, providing access to workflow-level context and utilities within steps. (Source: Mastra Releases via Perplexity Search)
- **Context Propagation**: Mastra vNext supports type-safe context propagation. Context can be passed through workflow steps, allowing shared data like API keys, user IDs, or utility functions (e.g., a callback to push intermediate stream updates). Explicit typing of context is a best practice. (Source: Perplexity Search)
  ```typescript
  // Conceptual example of typed context
  type MyWorkflowContext = {
    userId: string;
    apiKey: string;
    pushUpdate: (update: any) => void;
    // VercelAIStream adapter if provided by Mastra
    // vercelSDK?: VercelAIStreamAdapter; 
  };

  // Workflow might be initiated with context
  // workflow.execute(input, { context: myInitialContext }); 
  // Steps can access and modify context if designed to
  // const someStep = createStep<MyWorkflowContext>({ ... });
  ```
- **Specialized Step Types**: Mastra vNext may offer specialized step primitives, such as a `streamStep` that could simplify handling AI response formatting (e.g., for SSE) and integration with tools like the Vercel AI SDK. (Source: Perplexity Search - needs verification with official Mastra docs when available)
- **Error Handling & Step Retries**: Mastra provides robust mechanisms for handling errors, including:
    - **Conditional Branching**: Using `.branch()` (or `.if()/.else()`) for routing workflow execution based on error types or other conditions.
    - **Step Retries**: Built-in support for retrying failed steps, crucial for handling transient issues like network errors or rate limits.
        - **Configuration**: Retry behavior can be defined globally at the workflow level or overridden for specific steps.
          ```typescript
          // Workflow-level default retry config
          // const workflow = new Workflow({ 
          //   name: 'myWorkflow', 
          //   retryConfig: { attempts: 3, delay: 1000 } 
          // });

          // Step-level override
          // const someStep = new Step({
          //   id: 'criticalApiCall',
          //   execute: async () => { /* ... */ },
          //   retryConfig: { attempts: 5, delay: 2000, statusCodes: [429, 503] } 
          // });
          ```
        - **Parameters**: Key parameters include `attempts` (number of retries) and `delay` (fixed delay in ms). Specific `statusCodes` can trigger retries at the step level.
        - **Backoff Strategy**: Mastra primarily uses a fixed delay. Exponential backoff can be simulated by providing a function to the `delay` parameter: `delay: (attempt) => 1000 * Math.pow(2, attempt)`.
        - **Best Practices**: Use for transient errors, budget attempts/delays appropriately, combine with circuit breakers, and monitor retry metrics. (Source: Perplexity Search, Mastra Documentation via Perplexity)
- **Variable Mapping**: Precise data routing between steps using path-based syntax (e.g., `stepA.output.someKey`). (Source: Mastra Docs Overview)
- **Agents as Steps**: Direct embedding of pre-configured AI agents into workflows. (Source: Mastra Docs Overview)
- **LLM Integration**: Mastra is designed to work with LLM providers. For this project, LLM interactions (Gemini, Anthropic/Claude) will be managed via the Vercel AI SDK, which can be called from within Mastra steps. Mastra's role is orchestration, Vercel AI SDK handles the direct LLM communication. (Source: Mastra LLM Integration Details & User Feedback)

### 8.3. Prerequisite: Package Installation & Setup
   - **Action**: Install necessary packages.
     - `@mastra/core` (or the specific Mastra vNext core package) and `zod` for schemas.
     - `scrapybara` (TypeScript/Node.js SDK).
     - `@firecrawl/ts-sdk` for Firecrawl integration. (Source: Perplexity Search)
     - `@jina-ai/sdk` for Jina AI integration (if a dedicated search SDK is confirmed, otherwise direct API calls). (Source: Perplexity Search)
     - Ensure Vercel AI SDK (`ai` package) is up-to-date.
     - SDKs for Exa Search (e.g., `exa` or an official Node.js package).
   - **Update `package.json`**: Add/verify these dependencies.
   - **API Keys & Environment Variables**:
     - `SCRAPYBARA_API_KEY`: Already configured in `.env.local`.
     - `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`: Already configured.
     - `EXA_API_KEY`, `FIRECRAWL_API_KEY`, `JINA_API_KEY`: Add to `.env.local` and `example.env`.
     - Mastra-specific API keys if its platform features require them.

### 8.4. Proposed Refactoring Steps (Mastra Orchestration with Vercel AI SDK & Scrapybara)

#### 8.4.1. Define Mastra Schemas
   - **Action**: Define Zod schemas for all inputs/outputs of each Mastra step.
     - `UserQueryInputSchema`: `{ query: z.string() }`
     - `EnhancedQueryOutputSchema`: `{ enhancedQuery: z.string() }`
     - `PlanningAndEnhancedQueryOutputSchema`: `{ enhancedQuery: z.string(), subQuestions: z.array(z.string()).optional(), researchPlan: z.any().optional() }`
     - `SearchProviderInputSchema`: `{ enhancedQuery: z.string(), apiKey: z.string(), subQuestions: z.array(z.string()).optional(), numResults: z.number().optional() }` // Added numResults
     - `IndividualSearchResultItemSchema`: z.object({ // Renamed and detailed for a single item
       id: z.string().optional(), // From Exa
       url: z.string().url(),
       title: z.string().optional(),
       snippet: z.string().optional(), // Or 'text' if it's meant to be fuller content from initial search
       rawContent: z.string().optional(), // For content retrieved by Exa's getContents or similar
       author: z.string().optional(), // From Exa
       publishedDate: z.string().optional(), // From Exa
       highlights: z.array(z.object({ text: z.string(), score: z.number() })).optional(), // From Exa
       score: z.number().optional() // General relevance score
     })
     - `IndividualSearchResultsSchema`: `{ searchProvider: z.string(), results: z.array(IndividualSearchResultItemSchema) }` // To distinguish provider and hold items
     - `AggregatedSearchResultsSchema`: `{ aggregatedSearchResults: z.array(IndividualSearchResultItemSchema) }` // Uses the detailed item schema
     - `ScrapybaraPageScrapeInputSchema`: `{ targetUrl: z.string().url(), scrapybaraApiKey: z.string(), originalQuery: z.string(), subQuestion: z.string().optional() }`
     - `ExtractedPageContentOutputSchema`: `{ url: z.string().url(), content: z.array(z.string()), title: z.string().optional() }`
     - `RAGInputSchema`: `{ enhancedQuery: z.string(), subQuestions: z.array(z.string()).optional(), scrapedContents: z.array(ExtractedPageContentOutputSchema) }`
     - `RelevantChunksOutputSchema`: `{ relevantTexts: z.array(z.string()) }`
     - `StreamChunkOutputSchema`: `{ step: z.number(), type: z.string(), payload: z.any() }` (for streaming updates to frontend)
   - **Goal**: Type safety and clear data contracts between workflow steps.

#### 8.4.2. Create Mastra Steps
   - **Step 1: PlanningAndQueryEnhancementStep**
     - **Input**: `UserQueryInputSchema`.
     - **Logic**:
       - Initialize Vercel AI SDK for Gemini (Model: `google("gemini-2.5-pro@20250415-latest")` or equivalent Vercel AI SDK provider syntax). (Source: Perplexity Search)
       - Call Gemini 2.5 Pro with the user query and a system prompt focused on decomposing the query into sub-questions, identifying key entities, and formulating a brief research plan/strategy. Output should be structured (e.g., JSON with `enhancedQuery`, `subQuestions: string[]`, `searchStrategy: string`). Consider using JSON mode if supported reliably by the SDK for this model.
       - Use the original query and planning output to generate the final `enhancedQuery` for search engines.
       - Parse response.
     - **Output**: `PlanningAndEnhancedQueryOutputSchema`.
     - **Stream Update**: Enqueue `StreamChunkOutputSchema` with `type: "planning_enhancing"`, `payload: { enhancedQuery: output.enhancedQuery, subQuestions: output.subQuestions }`.
   - **Step 2A: ExaSearchStep**
     - **Input**: `SearchProviderInputSchema` (with Exa API key, `enhancedQuery`, and optional `subQuestions`).
     - **Logic**:
       - Initialize Exa client (e.g., `new Exa(input.apiKey)`). (Source: Perplexity Search)
       - Perform the search: Call `exa.search(input.enhancedQuery, { numResults: input.numResults || 5, /* other options like includeDomains, startPublishedDate derived from subQuestions/researchPlan if applicable */ })`. (Source: Perplexity Search)
       - For each result from the search, potentially call `exa.getContents([result.url])` or `exa.getContents(searchResponse.results)` to fetch full page content if not included sufficiently in the initial search response. The Exa SDK might have a combined `searchAndContents` or similar method; verify this for the Node.js SDK. If not, this step might involve sequential `getContents` calls or a batch call if available.
       - Transform Exa's output (search results and fetched content) to align with `IndividualSearchResultsSchema`, populating fields like `id`, `url`, `title`, `snippet` (from search), `rawContent` (from getContents), `author`, `publishedDate`, `highlights`.
     - **Output**: `IndividualSearchResultsSchema` (containing `searchProvider: "Exa"` and the list of results).
   - **Step 2B: FirecrawlSearchStep**
     - **Input**: `SearchProviderInputSchema` (with Firecrawl API key, `enhancedQuery`, optional `numResults`).
     - **Logic**:
       - Initialize Firecrawl client: `new FirecrawlApp({ apiKey: input.apiKey })`. (Source: Perplexity Search)
       - Call `app.search({ query: input.enhancedQuery, limit: input.numResults || 5, scrapeOptions: { formats: ['markdown'] } /* other options like tbs, lang, country if derived from researchPlan */ })`. (Source: Perplexity Search)
       - Transform Firecrawl's response: For each item in `response.data`, map its fields (`title`, `description`, `url`, `markdown`, `html`, `metadata.sourceURL`) to the `IndividualSearchResultItemSchema`. Use `markdown` or `html` for `rawContent`, and `description` for `snippet`.
     - **Output**: `IndividualSearchResultsSchema` (containing `searchProvider: "Firecrawl"` and the list of results).
   - **Step 2C: JinaSearchStep**
     - **Input**: `SearchProviderInputSchema` (with Jina API key, `enhancedQuery`, optional `numResults`).
     - **Logic**:
       - Initialize Jina AI client: `new JinaClient({ apiKey: input.apiKey, endpoint: 'https://api.jina.ai/v1/search' })` or use direct fetch to the search endpoint. (Source: Perplexity Search)
       - Call Jina AI's search: e.g., `client.search({ query: input.enhancedQuery, parameters: { model: 'jina-embeddings-v3', top_k: input.numResults || 5, /* filters like lang, doc_type if applicable */ } })`. (Source: Perplexity Search)
       - Transform Jina's response: For each item in `response.results`, map its fields (`id`, `score`, `text`, `metadata` like `source`, `lang`) to the `IndividualSearchResultItemSchema`. Use `text` for `snippet` or `rawContent` as appropriate.
     - **Output**: `IndividualSearchResultsSchema` (containing `searchProvider: "JinaAI"` and the list of results).
   - **Step 2D: AggregateAndDeduplicateSearchResultsStep**
     - **Input**: Outputs from ExaSearchStep, FirecrawlSearchStep, JinaSearchStep, and `PlanningAndEnhancedQueryOutputSchema` (for context).
     - **Logic**:
       - Combine all `searchResults` arrays. Deduplicate URLs.
       - *Optional LLM Evaluation*: Use Gemini 2.5 Pro (via Vercel AI SDK) to rank/filter URLs based on relevance to the `enhancedQuery` and `subQuestions`.
     - **Output**: `AggregatedSearchResultsSchema`.
     - **Stream Update**: Enqueue `StreamChunkOutputSchema` with `type: "searching_completed"`, `payload: { count: output.aggregatedSearchResults.length }`.
   - **Step 3: ScrapeWebpageStep (using Scrapybara - Parallelizable per URL from Aggregated Results)**
     - **Input**: `ScrapybaraPageScrapeInputSchema` (includes `targetUrl`, `scrapybaraApiKey`, `originalQuery` (which is the `enhancedQuery`), and potentially a specific `subQuestion` if applicable to focus scraping).
     - **Logic**:
       - Initialize (or reuse) `ScrapybaraClient`.
       - Use `client.act()` (controlled by Vercel AI SDK with Claude model: `anthropic("claude-3-7-sonnet@20250219")` or equivalent Vercel AI SDK provider syntax). (Source: Perplexity Search) The prompt should be tailored by `originalQuery` or specific `subQuestion` to guide focused extraction (max 3 valuable sections, max 5 scrolls, etc.).
     - **Output**: `ExtractedPageContentOutputSchema`.
     - **Stream Update**: Enqueue `StreamChunkOutputSchema` with `type: "reading_source"`, `payload: { link: input.targetUrl, contentBlocks: output.content.length }`.
   - **Step 4: GenerateEmbeddingsAndSemanticSearchStep (RAG)**
     - **Input**: An array of `ExtractedPageContentOutputSchema`, `PlanningAndEnhancedQueryOutputSchema`.
     - **Logic**:
       - For each scraped content: generate embeddings (e.g., using Jina AI Embeddings or a Gemini embedding model via Vercel AI SDK).
       - Store in a temporary in-memory vector store.
       - Perform semantic search against this store using `enhancedQuery` and/or `subQuestions`.
       - *Optional LLM Evaluation*: Use Gemini 2.5 Pro to evaluate relevance of retrieved chunks.
     - **Output**: `RelevantChunksOutputSchema`.
   - **Step 5: SummarizeContentStep (Streaming Output)**
     - **Input**: `RelevantChunksOutputSchema`, `PlanningAndEnhancedQueryOutputSchema`.
     - **Logic**:
       - Initialize Vercel AI SDK for Gemini (Model: `google("gemini-2.5-pro@20250415-latest")` or equivalent Vercel AI SDK provider syntax). (Source: Perplexity Search)
       - Use `input.relevantTexts` and context from `input.planningAndEnhancedQueryOutput` to generate a focused summary (HTML, Tailwind, citations).
       - Ensure Gemini 2.5 Pro streams the output. The Vercel AI SDK (e.g., using `streamText` and then `toAIStream()`) will produce a `ReadableStream`.
       - This Mastra step should return this `ReadableStream` directly.
       - *Alternatively, if Mastra vNext offers a specialized `streamStep` primitive, it could be used here to simplify AI response formatting (e.g., for SSE) and integration.* (Source: Perplexity Search - needs verification)
     - **Output**: A `ReadableStream` (compatible with Web APIs and Vercel AI SDK's `StreamingTextResponse`).
     - **Stream Update**: Enqueue `StreamChunkOutputSchema` with `type: "summarizing_started"`, `payload: { loading: true }`. This update would be sent via the `pushUpdateToClient` callback from the workflow context *before* the main content stream begins.

#### 8.4.3. Design the Mastra vNext Workflow
   - **Action**: Compose the steps into a Mastra workflow.
     ```typescript
     // Conceptual Mastra Workflow for Scrpexity (Updated for Diversified Search & Planning)
     import { createWorkflow, createStep } from '@mastra/core';
     // ... import schemas and step function definitions ...

     const scrpexitySearchWorkflow = createWorkflow({
       name: 'ScrpexitySearchWorkflow',
       inputSchema: UserQueryInputSchema,
       outputSchema: z.object({ finalSummaryStream: z.instanceof(ReadableStream) })
     })
       .then(PlanningAndQueryEnhancementStep, { // Step 1
         input: (ctx) => ({ query: ctx.workflowInput.query })
       })
       .parallel([ // Step 2A, 2B, 2C
         createStep(ExaSearchStep, {
           input: (ctx) => ({ 
             enhancedQuery: ctx.steps.PlanningAndQueryEnhancementStep.output.enhancedQuery, 
             subQuestions: ctx.steps.PlanningAndQueryEnhancementStep.output.subQuestions,
             apiKey: process.env.EXA_API_KEY || "" 
           })
         }),
         createStep(FirecrawlSearchStep, {
           input: (ctx) => ({ 
             enhancedQuery: ctx.steps.PlanningAndQueryEnhancementStep.output.enhancedQuery,
             apiKey: process.env.FIRECRAWL_API_KEY || ""
           })
         }),
         createStep(JinaSearchStep, {
           input: (ctx) => ({ 
             enhancedQuery: ctx.steps.PlanningAndQueryEnhancementStep.output.enhancedQuery,
             apiKey: process.env.JINA_API_KEY || ""
           })
         })
       ])
       .then(AggregateAndDeduplicateSearchResultsStep, { // Step 2D
         input: (ctx) => ({
           exaResults: ctx.previousStepOutput[0].searchResults, 
           firecrawlResults: ctx.previousStepOutput[1].searchResults,
           jinaResults: ctx.previousStepOutput[2].searchResults,
           planningAndEnhancedQueryOutput: ctx.steps.PlanningAndQueryEnhancementStep.output // Pass for context if needed in evaluation
         })
       })
       .parallel( // Step 3 (Parallel scraping)
         (ctx) => ctx.previousStepOutput.aggregatedSearchResults.map((searchResult, index) =>
           createStep(ScrapeWebpageStep, {
             input: { 
               targetUrl: searchResult.url, 
               scrapybaraApiKey: process.env.SCRAPYBARA_API_KEY || "",
               originalQuery: ctx.steps.PlanningAndQueryEnhancementStep.output.enhancedQuery,
               // Optionally pass a specific subQuestion if the plan is granular enough
               // subQuestion: ctx.steps.PlanningAndQueryEnhancementStep.output.subQuestions?.[index % ctx.steps.PlanningAndQueryEnhancementStep.output.subQuestions.length] 
             },
             name: `Scrape-${searchResult.url.substring(0,20)}`
           })
         )
       )
       .then(GenerateEmbeddingsAndSemanticSearchStep, { // Step 4 (RAG)
         input: (ctx) => ({ 
           scrapedContents: ctx.previousStepOutput, // Array of ExtractedPageContentOutputSchema
           planningAndEnhancedQueryOutput: ctx.steps.PlanningAndQueryEnhancementStep.output
         })
       })
       .then(SummarizeContentStep, { // Step 5
         input: (ctx) => ({ 
           relevantChunks: ctx.previousStepOutput.relevantTexts, 
           planningAndEnhancedQueryOutput: ctx.steps.PlanningAndQueryEnhancementStep.output 
         })
       });
     ```
   - **Goal**: A modular, type-safe, and observable pipeline using Mastra's orchestration, with parallelized initial search and RAG. The workflow design should leverage Mastra's capabilities for type-safe context propagation (for API keys, callbacks, etc.) and robust error handling. This includes using `.branch()` for conditional logic based on error types, and configuring step-specific retry policies (defining attempts, delays, and applicable status codes) for external API calls (e.g., to search providers, Scrapybara, LLMs) to handle transient failures.
   - **Streaming Updates**: Each Mastra step that provides a significant update (enhanced query, new link found, error) should be designed to also call a shared "update stream" function (e.g., `pushUpdateToClient`) passed via the workflow's type-safe context. Alternatively, the workflow runner itself could tap into step outputs to send these updates. This is separate from the final summary stream.

#### 8.4.4. Integrate Mastra Workflow with Next.js API Route (`/api/enhance-search/route.ts`)
   - **Action**:
     1. The API route will receive the user query and `searchId`.
     2. It will invoke `scrpexitySearchWorkflow.execute({ query })`.
     3. **Handling Intermediate Stream Updates**:
        - The Mastra workflow execution needs a mechanism to push discrete JSON status updates (Step 1, 2, 3 type messages from current implementation) to the client *while the workflow is running*. This could be a callback passed into the workflow context, which enqueues data to the main `ReadableStream` controller of the API route.
        ```typescript
        // Inside API Route
        const streamController; // From new ReadableStream
        const pushUpdateToClient = (update) => streamController.enqueue(encoder.encode(JSON.stringify(update) + '\n'));
        
        const workflowResult = await scrpexitySearchWorkflow.execute(
          { query }, 
          // Ensure context aligns with a defined type, e.g., MyWorkflowContext from 8.2
          { context: { pushUpdate: pushUpdateToClient, userId: session.user.id /* other context items like API keys */ } } 
        );
        // The SummarizeContentStep's output (a ReadableStream) is now in workflowResult.output.finalSummaryStream
        ```
     4. **Handling Final Summary Stream**:
        - The `SummarizeContentStep` is designed to output a `ReadableStream` (e.g., from Vercel AI SDK's `OpenAIStream` or similar).
        - The API route will take this stream from the workflow's final step output and pipe it into the `StreamingTextResponse` or directly into the `Response` if it's already a compatible Web API stream.
        ```typescript
        // After workflow execution, if SummarizeContentStep returned a stream:
        const sdkStreamObject = workflowResult.output.finalSummaryStream; // Assuming this is the object from streamText() or similar
        // Use toAIStream() to convert to a Web API ReadableStream for the Response object
        // StreamingTextResponse is a convenience wrapper around this.
        // For more control or if mixing with other stream parts manually, using Response directly might be an option.
        if (sdkStreamObject && typeof sdkStreamObject.toAIStream === 'function') {
          return new Response(await sdkStreamObject.toAIStream(), {
            headers: { 'Content-Type': 'text/event-stream' } // Or application/octet-stream depending on AI SDK conventions
          });
        } else if (sdkStreamObject instanceof ReadableStream) {
          // If it's already a raw ReadableStream, it might be directly usable or need wrapping by StreamingTextResponse
          return new StreamingTextResponse(sdkStreamObject);
        }
        // Fallback or error handling if stream is not as expected
        ```
     5. Database interactions (Supabase upserts/updates) can occur within Mastra steps or be orchestrated by the API route before/after workflow execution or via workflow context/callbacks.
   - **Goal**: Maintain the step-by-step UI updates and stream the final summary, orchestrated by Mastra.

#### 8.4.5. Scrapybara Integration within Mastra Steps
   - **Action**:
     - The Mastra steps (`InitialDuckDuckGoSearchStep`, `ScrapeWebpageStep`) will encapsulate all Scrapybara `client.act()` calls.
     - Prompts for `client.act()` will be constructed within these steps, using input data (e.g., enhanced query, URL to scrape).
     - Scrapybara API key will be passed securely to these steps (e.g., via input mapping from environment variables or workflow context).
     - Error handling for Scrapybara (API key issues, credits, session limits) will be managed within these steps, and critical errors can either throw to halt the Mastra workflow or return specific error objects/schemas. Status updates for these errors should be pushed to the client stream.
   - **Goal**: Robust and maintainable Scrapybara usage, benefiting from Mastra's structure.

### 8.5. Addressing the Vercel Streaming Issue with Mastra & Vercel AI SDK
- **Mastra's Role**: Mastra itself doesn't directly solve Vercel Edge streaming limitations but provides a structured way to manage the data flow.
- **Focus**: The final step of the Mastra workflow that produces data for the client, or an adapter step after the workflow, will still need to correctly implement `ReadableStream` principles compatible with Vercel Edge.
- **Benefit**: By breaking down the process into testable Mastra steps, it might be easier to pinpoint if a specific data transformation or AI call *before* streaming is causing issues or delays that affect the stream on Vercel.

### 8.5. Testing and Validation
- Test each Mastra step individually.
- Test the complete Mastra workflow locally.
- Test the Next.js API route invoking the Mastra workflow, focusing on the streaming output, both locally and on Vercel.

### 8.6. General Best Practices for Vercel Edge & Streaming (from Perplexity Search)
   - **Leverage Edge Config**: Consider using Vercel Edge Config for dynamic parameters related to scraping or workflow behavior (e.g., target site rules, agent prompts, feature flags for workflow paths). This allows changes without redeployment.
     - *Action*: Identify if any parts of the Scrapybara or AI agent logic could benefit from dynamic configuration via Edge Config.
   - **Optimize Edge Network Usage & Step Performance**:
     - Keep scraped payloads or intermediate data chunks small.
     - Design Mastra workflow steps (especially non-streaming, synchronous parts) to execute quickly, ideally under 50ms, to fit within Edge Function execution limits. (Source: Perplexity Search)
     - For external calls (Scrapybara, AI models), ensure they are efficient. Batch non-streaming API calls in parallel branches within Mastra if possible. (Source: Perplexity Search)
     - Configure Edge Function memory (e.g., `maxMemoryMB: 256`) and consider `streamData: true` for large payloads if using Vercel AI SDK features that support it. If Mastra allows configuring step-specific memory/duration for Edge deployments, utilize this. (Source: Perplexity Search)
   - **Efficient Stream Processing & Data Handling**:
     - **Incremental Data Streaming**: This is key. If Mastra produces data incrementally, ensure it's piped efficiently to the `Response` stream. Leverage async iterators for Mastra's stream handling, which can provide automatic backpressure. (Source: Perplexity Search)
     - **Chunk Batching**: Consider buffering a few tokens (e.g., 3-5) before emitting a chunk to the client to balance latency and efficiency. (Source: Perplexity Search)
     - **Encoding/Decoding**: Use `TextDecoderStream` and `TextEncoderStream` for efficient text processing. Be mindful of provider-specific encoding (e.g., Gemini responses might be base64 and need decoding, while Claude uses UTF-8). (Source: Perplexity Search)
     - Prefer `pipeThrough()` for `TransformStream` chains over manual handling where appropriate. (Source: Perplexity Search)
     - Consider Mastra's `autoAllocateChunkSize` for predictable memory allocation if available and relevant. (Source: Perplexity Search)
     - **JSON Validation**: Use Zod schemas (already planned for Mastra steps) to validate any JSON data within the stream, ensuring robustness. (Source: Perplexity Search)
   - **Robust Error Handling, Timeouts & Fallbacks**:
     - Implement reasonable timeouts for external calls within Mastra steps (e.g., 25s for text-heavy streams, 40s for JSON-heavy streams, adjust as needed). Mastra steps should ideally support timeout configurations. (Source: Perplexity Search)
     - **Mastra Step Retries**: Leverage Mastra's built-in step retry capabilities for transient errors.
        - Configure `attempts`, `delay` (fixed), and `statusCodes` at the step level for external API calls (search, scrape, LLM). (Source: Perplexity Search, Mastra Documentation via Perplexity)
        - Simulate exponential backoff if needed: `delay: (attempt) => initialDelay * Math.pow(factor, attempt)`. (Source: Perplexity Search, Mastra Documentation via Perplexity)
        - Apply retry budgeting: more attempts for critical steps, fewer for less critical ones to balance reliability and latency.
        - Use retries only for transient issues (e.g., network errors, rate limits like 429, 503), not for permanent errors (e.g., 400, 401, 403).
     - Implement stream cancellation rigorously (e.g., in `finally` blocks of async operations within stream generation) and use `AbortController` patterns, respecting Vercel Edge timeout limits. (Source: Perplexity Search)
     - Attach error metadata to stream chunks (if sending structured updates) for richer client-side error display or recovery. (Source: Perplexity Search)
     - Implement fallback strategies (e.g., trying an alternative search provider or LLM model) using Mastra's conditional branching if a step ultimately fails after retries. (Source: Perplexity Search)
       ```typescript
       // Conceptual fallback logic within a Mastra workflow, after a step with retries
       // .if((ctx) => ctx.steps.someApiCallStep.error)
       //   .step(fallbackApiCallStep, { ... })
       // .else()
       //   .step(nextNormalStep, { input: (ctx) => ctx.steps.someApiCallStep.output })
       ```
     - Consider combining retries with circuit breaker patterns for services prone to longer outages (check service health before attempting calls).
   - **Production Considerations**:
     - **Content Security Policies (CSP)**: Implement appropriate CSP headers, especially if streaming HTML that might include structured data or scripts. (Source: Perplexity Search)
     - **Rate Limiting**: Implement per-user rate limiting for the API endpoint. (Source: Perplexity Search)
     - **Client-Side Parsing**: For complex or high-volume streams, consider using client-side WebAssembly (WASM) workers for parsing to offload the main thread. (Source: Perplexity Search)
     - **Feature Flagging**: Use feature flags for significant workflow changes to enable gradual rollouts.
     - **Caching**: Cache frequently accessed, non-dynamic data at the edge.
     - **Pre-warming**: If Mastra offers deployment hooks or mechanisms for pre-warming Edge functions, consider using them. (Source: Perplexity Search)

---
*This plan was formulated based on available project information and general knowledge of Vercel/Next.js streaming and Mastra vNext concepts. Direct code inspection and iterative debugging on Vercel will be essential.*
*MCP Tool Usage: Perplexity search was used for background research. GitHub and Mastra MCPs remain unavailable due to connection issues, limiting the depth of specific examples for Mastra and Scrapybara integration patterns on Vercel Edge.*

### 8.7. Advanced Mastra Capabilities for Future Enhancement

Beyond the core refactoring, Mastra offers several advanced features that could be incorporated in future iterations to further enhance the Scrpexity agent:

- **Event-Driven Workflows**:
    - **Concept**: Mastra supports workflows that can pause and wait for external events before resuming. This is managed via `.afterEvent(eventName)` within a workflow step (to suspend) and `.resumeWithEvent(eventName, eventData)` called externally (e.g., via an API endpoint) to continue the workflow.
    - **Configuration**: Events and their expected data payloads must be defined with Zod schemas in the workflow configuration (e.g., `events: { myEvent: { schema: z.object({ ... }) } }`).
    - **Use Cases for Scrpexity**:
        - **User Feedback Loops**: Pause a workflow after summarization to await user feedback (e.g., rating, correction) submitted via the UI, then resume to refine results or log feedback.
        - **Long-Running Scrapes/Analysis**: If a particular scraping or deep analysis task within the workflow is exceptionally long, it could be designed to emit an event upon completion, allowing the main workflow to suspend and free up resources, then resume when the sub-task signals completion.
        - **Integration with External Callbacks**: If any part of the process involves services that use webhooks or asynchronous callbacks.
    - **Benefits**: Improved resource management for long-running tasks, ability to incorporate human-in-the-loop processes, and better coordination of asynchronous operations. (Source: Perplexity Search, Mastra Documentation via Perplexity)

- **Persistent Conversation Memory & Context Management**:
    - **Concept**: Mastra includes a `Memory` class for managing conversational history and context persistently. It supports thread-based organization of messages and can integrate with various storage backends.
    - **Key Features & Methods**:
        - **Thread Management**: `createThread()`, `getThreadById()`, `getThreadsByResourceId()` for organizing and retrieving conversation histories.
        - **Querying Memory**: `query()` method for semantic and keyword-based search across stored conversations, with options like `topK` and `messageRange`.
        - **Storage Backends**: Supports modular storage. LibSQL is a default option (e.g., `new LibSQLStore({url: "file:memory.db"})`). Other potential backends include PostgreSQL, Upstash, Cloudflare KV, and D1, suitable for different scaling and deployment needs (e.g., edge).
        - **Vector Storage**: Integrates with vector stores (e.g., `new LibSQLVector()`) for semantic recall, potentially using FastEmbed for automatic embedding generation.
        - **Working Memory**: Allows defining templates for structured data within the memory, useful for maintaining specific contextual information (e.g., user preferences, session data).
        - **Configuration**: Options like `lastMessages` to control the number of recent messages in active context.
    - **Use Cases for Scrpexity**:
        - **Multi-Turn Conversations**: Maintain context across multiple interactions with a user for a single search task or follow-up questions.
        - **Personalization**: Store user preferences or past search patterns to tailor future interactions (requires careful privacy consideration).
        - **Long-Term Learning (Advanced)**: Potentially learn from past interactions to improve search strategies or summarization over time.
        - **Caching**: Store results of expensive operations (like initial LLM-based query enhancement or summaries for identical queries) associated with a conversation thread or user ID.
    - **Benefits**: Enables more stateful and context-aware agent behavior, personalized user experiences, and efficient reuse of information. (Source: Perplexity Search, Mastra Documentation via Perplexity)

- **Enhanced Observability with Laminar (or similar OTel provider)**:
    - **Concept**: Mastra supports OpenTelemetry (OTLP) for exporting traces and metrics. This can be integrated with observability platforms like Laminar, which are specialized for LLM applications.
    - **Setup & Configuration**:
        - Requires setting environment variables for the OTLP endpoint and authentication headers (e.g., `OTEL_EXPORTER_OTLP_ENDPOINT=https://api.lmnr.ai:8443`, `OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <LAMINAR_API_KEY>, x-laminar-team-id=<LAMINAR_TEAM_ID>"`).
        - Mastra initialization needs to enable telemetry and configure the OTLP gRPC exporter:
          ```typescript
          // const mastra = new Mastra({
          //   telemetry: {
          //     serviceName: "scrpexity-agent",
          //     enabled: true,
          //     export: { type: "otlp", protocol: "grpc" },
          //     // Optional: Add custom metadata to all traces
          //     // metadata: { 'deployment_env': process.env.NODE_ENV } 
          //   },
          // });
          ```
    - **Key Features & Benefits**:
        - **Centralized Tracing**: View detailed traces of workflow executions, including individual step performance, LLM calls (prompts, responses, token usage), and tool interactions in a platform like Laminar.
        - **Nested Spans**: Use provider-specific wrappers (e.g., Laminar's `observe` function) to create custom, nested spans around critical code sections for finer-grained tracing.
        - **Metadata Tagging**: Add custom tags to traces for better filtering and analysis (e.g., by user ID, query type, environment).
        - **Performance Monitoring**: Identify bottlenecks, high-latency steps, cold start issues, and monitor error rates.
        - **Debugging**: Facilitates easier debugging of complex, distributed agent behavior.
    - **Use Cases for Scrpexity**:
        - Monitor the performance and reliability of each step in the search and summarization pipeline.
        - Track costs associated with LLM calls (token usage).
        - Debug errors or unexpected behavior in production.
        - Analyze user interaction patterns if client-side tracing is also integrated.
    - **Note**: While Laminar is mentioned, any OTel-compatible observability platform (Dash0, SigNoz, LangSmith, etc.) could be used with Mastra's OTel exporter. The choice depends on specific feature needs and pricing. (Source: Perplexity Search, Mastra Documentation via Perplexity)

# Additional Implementation Notes Based on Code Review

Based on a thorough review of the codebase, documentation, and implementation plan, here are some additional considerations and validations:

## 1. Vercel Streaming API Issue Diagnosis

The identified issue in the `src/app/api/enhance-search/route.ts` file aligns with the plan's diagnosis. The current implementation uses a `ReadableStream` with an async `start` handler that:

1. Performs multiple async operations (Gemini query enhancement, Scrapybara instance setup, scraping loop)
2. Enqueues multiple JSON-stringified updates with `controller.enqueue`
3. Uses complex error handling for various Scrapybara API errors

This approach may be incompatible with Vercel Edge Runtime for the reasons outlined in the implementation plan:
- Long-running operations within the stream `start` method
- Potential unhandled promise rejections during async operations
- Complex buffering and flow control requirements

## 2. Vercel AI SDK Integration Validation

The plan to use Vercel AI SDK for handling streaming is well-founded. Specifically:

- The SDK's `streamText` function provides robust, battle-tested streaming capabilities
- The API route should use a `TransformStream` to handle both status updates and final streaming content
- Following the SDK's recommendation for "lazy" stream production rather than eager/backpressure-unaware streaming

## 3. Mastra Workflow Architecture Alignment

The Mastra vNext architecture proposed aligns well with the current codebase structure:

- The current code already follows a clear step-based approach (query enhancement, scraping, summarization)
- Each step's outputs are well-defined and could be mapped to proper Zod schemas
- Error handling already includes specific error types and responses that can be mapped to Mastra's structured approach

## 4. LLM Provider Selections

The implementation plan's LLM provider selections are appropriate:

- Gemini 2.5 Pro is well-suited for the planning and summarization tasks
- Claude 3.7 Sonnet remains a good choice for Scrapybara control
- The diversified search approach using Exa, Firecrawl, and Jina AI should provide more robust results than the current DuckDuckGo-only approach

## 5. Potential Implementation Optimizations

Based on the code review, a few additional optimizations could be considered:

- Add small delays between search provider parallel steps to avoid potential rate limiting
- Consider implementing a circuit breaker pattern for the Scrapybara instances to avoid wasting credits on failed retries
- Implement more granular logging throughout the Mastra workflow for better observability
- Store intermediate results in Supabase directly from appropriate Mastra steps for better recoverability

## 6. Database Schema Compatibility

The current Supabase schema (`searches` and `users` tables) remains compatible with the proposed implementation. The Mastra workflow should continue to:

- Create initial records when searches begin
- Update with sources as they're collected
- Finalize with the summary when complete

No schema changes are needed to support the new architecture.

## 7. Client-Side Considerations

The current client implementation in `search-results.tsx` is already well-structured to handle the streaming updates. The existing step model with:

```typescript
{ step: 1, enhancedQuery } // for query enhancement
{ step: 2, streamUrl } // for search initiation
{ step: 3, link, contentBlocks } // for each source
{ step: 4, summary, loading: false } // for final summary
```

Can be maintained to ensure UI compatibility, even as the backend implementation changes to Mastra vNext.

The Mastra implementation should maintain this exact stream structure to ensure frontend compatibility.
