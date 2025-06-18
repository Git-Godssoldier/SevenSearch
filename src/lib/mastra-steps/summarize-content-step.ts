import { z } from 'zod';
import { createStep, type WorkflowContext } from '../mastra-types';
import { RelevantChunksOutputSchema, PlanningAndEnhancedQueryOutputSchema } from '../mastra-schemas';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { StreamingTextResponse } from '@/lib/utils/streaming';

/**
 * Summarize Content Step
 *
 * Uses Gemini 2.5 Pro to generate a comprehensive, cited summary of the extracted
 * content, structured in HTML with Tailwind CSS classes.
 */
export const summarizeContentStep = createStep({
  name: 'SummarizeContentStep',
  inputSchema: z.object({
    relevantTexts: z.array(z.string()),
    planningOutput: PlanningAndEnhancedQueryOutputSchema,
  }),
  outputSchema: z.object({
    summary: z.any(), // This will be a ReadableStream
    generationComplete: z.boolean()
  }),
  execute: async ({ data, context }) => {
    // Track attempt count for retries
    let attemptCount = 0;
    const maxAttempts = 3;

    // Function to process content to avoid token limit errors
    const processContentForSummary = (texts: string[], queryContext: string): string => {
      // Estimate total content length
      const estimatedLength = texts.join('\n\n').length;
      const targetLength = 100000; // Target character length based on token limits

      if (estimatedLength <= targetLength) {
        return texts.join('\n\n');
      }

      console.log(`[MastraStep: SummarizeContentStep] Content length (${estimatedLength}) exceeds target (${targetLength}). Truncating...`);

      // Sort texts by relevance if possible (simple heuristic: check if they contain query terms)
      const queryTerms = queryContext.toLowerCase().split(/\s+/).filter(t => t.length > 3);

      if (queryTerms.length > 0) {
        texts = texts.sort((a, b) => {
          const aLower = a.toLowerCase();
          const bLower = b.toLowerCase();

          const aMatches = queryTerms.filter(term => aLower.includes(term)).length;
          const bMatches = queryTerms.filter(term => bLower.includes(term)).length;

          return bMatches - aMatches; // Higher matches first
        });
      }

      // Truncate content to fit within token limits
      let totalLength = 0;
      const selectedTexts: string[] = [];

      for (const text of texts) {
        if (totalLength + text.length > targetLength) {
          break;
        }

        selectedTexts.push(text);
        totalLength += text.length + 2; // +2 for the newline characters
      }

      console.log(`[MastraStep: SummarizeContentStep] Selected ${selectedTexts.length} out of ${texts.length} text chunks`);
      return selectedTexts.join('\n\n');
    };

    // Function to create system prompt with extraction of source URLs
    const createSystemPrompt = (queryContext: string, content: string): string => {
      // Extract potential URLs from content for citation
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const extractedUrls = new Set<string>();

      content.replace(urlRegex, (match) => {
        // Clean up URL - remove trailing punctuation and parentheses
        const cleanUrl = match.replace(/[.,;:!?)]+$/, '');
        extractedUrls.add(cleanUrl);
        return match;
      });

      const sourceUrls = Array.from(extractedUrls).slice(0, 15); // Limit to 15 URLs to avoid prompt size issues
      const sourcesList = sourceUrls.map((url, i) =>
        `[${i+1}] ${url}`
      ).join('\n');

      return `
        You are Q-Search, an advanced AI search assistant that provides comprehensive answers with rigorous citations.

        You will analyze the content provided from multiple web sources and generate a well-structured, informative
        response to the user's original query: "${queryContext}"

        The following sources were used to gather information (use these exact URLs for citations):
        ${sourcesList}

        Guidelines:
        1. Provide a thorough, well-reasoned answer that directly addresses the query
        2. Structure your response in HTML with Tailwind CSS classes for clean formatting
        3. Include ALL relevant information from the provided content
        4. For EVERY statement of fact, include a numbered citation [1], [2], etc. matching the source list above
        5. Add a "Sources" section at the end with FULL URLs for each citation
        6. Use neutral, factual language appropriate for a research tool
        7. Highlight key points or insights that are particularly relevant
        8. If sources conflict, acknowledge different perspectives
        9. If the content doesn't fully answer the query, acknowledge limitations

        Required HTML format:
        <div class="answer-container">
          <h2 class="text-xl font-bold mb-4">Your main heading here</h2>

          <div class="mb-6">
            <p class="mb-2">Your analysis and explanation here with citations[1].</p>
            <p class="mb-2">More content with additional citations[2][3].</p>
          </div>

          <h3 class="text-lg font-semibold mb-2">Subheading for another section</h3>
          <div class="mb-6">
            <p class="mb-2">Content for this subsection with citations[4].</p>
            <ul class="list-disc ml-5 mb-4">
              <li>List item one[5]</li>
              <li>List item two[6]</li>
            </ul>
          </div>

          <h3 class="text-lg font-semibold mb-2">Sources</h3>
          <ol class="list-decimal ml-5">
            <li><a href="full-url-1" class="text-blue-600 hover:underline">Source title or domain</a></li>
            <li><a href="full-url-2" class="text-blue-600 hover:underline">Source title or domain</a></li>
            <!-- Additional sources as needed -->
          </ol>
        </div>
      `;
    };

    // Main execution logic with retry
    const executeWithRetry = async (): Promise<{
      summary: StreamingTextResponse,
      generationComplete: boolean
    }> => {
      try {
        attemptCount++;

        // Send status update that summarization is starting
        context.pushUpdateToClient({
          step: 4,
          type: "summarizing",
          payload: {
            loading: true,
            message: "Analyzing content and generating comprehensive answer..."
          }
        });

        // Initialize Google Generative AI
        if (!context.GEMINI_API_KEY) {
          throw new Error("Gemini API key is required but not provided");
        }

        const genAI = new GoogleGenerativeAI(context.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-pro@20250415-latest",
          generationConfig: {
            temperature: 0.4,
            topP: 0.8,
            maxOutputTokens: 4000,
            safetySettings: [
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_ONLY_HIGH",
              }
            ]
          },
        });

        // Process and prepare content
        const processedContent = processContentForSummary(
          data.relevantTexts,
          data.planningOutput.enhancedQuery || data.planningOutput.originalQuery
        );

        // Create a system prompt with extracted URLs for citations
        const systemPrompt = createSystemPrompt(
          data.planningOutput.enhancedQuery || data.planningOutput.originalQuery,
          processedContent
        );

        console.log(`[MastraStep: SummarizeContentStep] Generating summary with ${processedContent.length} characters of content`);

        // Generate streaming response
        const genResponse = await model.generateContentStream({
          contents: [
            { role: 'user', parts: [{ text: `Here is the content to summarize and analyze:\n\n${processedContent}` }] }
          ],
          generationConfig: {
            temperature: 0.4,
            topP: 0.8,
            maxOutputTokens: 4000,
          },
          systemInstruction: systemPrompt
        });

        // Create a ReadableStream from the generative AI response
        const stream = genResponse.stream;

        // Create streaming text response
        const streamingResponse = new StreamingTextResponse(stream);

        // Set up a completion event handler
        setTimeout(() => {
          context.pushUpdateToClient({
            step: 4,
            type: "summarizing",
            payload: {
              loading: false,
              message: "Summary generation complete"
            }
          });
        }, 1000);

        return {
          summary: streamingResponse,
          generationComplete: true
        };
      } catch (error) {
        console.error(`[MastraStep: SummarizeContentStep] Error (attempt ${attemptCount}/${maxAttempts}):`, error);

        // Check if we should retry
        if (attemptCount < maxAttempts) {
          console.log(`[MastraStep: SummarizeContentStep] Retrying (${attemptCount}/${maxAttempts})...`);

          context.pushUpdateToClient({
            step: 4,
            type: "summarizing",
            payload: {
              loading: true,
              message: `Retrying summary generation (attempt ${attemptCount}/${maxAttempts})...`
            }
          });

          // If we hit a content filtering issue or token limit, try with less content
          if (
            error instanceof Error &&
            (error.name === "GenerativeContentError" ||
              error.message.includes("token") ||
              error.message.includes("content")) &&
            Array.isArray(data.relevantTexts)
          ) {
            data.relevantTexts = data.relevantTexts.slice(
              0,
              Math.ceil(data.relevantTexts.length * 0.7)
            ); // Reduce content by 30%
          }

          // Add delay between retries (exponential backoff)
          await new Promise(r => setTimeout(r, 1000 * attemptCount));
          return executeWithRetry();
        }

        // We've exhausted our retries, send error update to client
        context.pushUpdateToClient({
          step: 4,
          type: "summarizing",
          payload: {
            loading: false,
            error: true,
            errorMessage: error instanceof Error ? error.message : "Unknown error during summarization"
          },
          error: true,
          errorType: error instanceof Error ? error.name : "Unknown"
        });

        // Try fallback to a simpler summary approach
        try {
          return await generateFallbackSummary(error);
        } catch (fallbackError) {
          // Even our fallback failed, generate a static error response
          return generateErrorResponse(error);
        }
      }
    };

    // Fallback summary generation for when Gemini API fails
    const generateFallbackSummary = async (originalError: any): Promise<{
      summary: StreamingTextResponse,
      generationComplete: boolean
    }> => {
      console.log("[MastraStep: SummarizeContentStep] Attempting fallback summary generation");

      try {
        // Take only the first few chunks of content to minimize token usage
        const limitedTexts = Array.isArray(data.relevantTexts)
          ? data.relevantTexts.slice(0, 3)
          : [];
        const fallbackContent = limitedTexts.join('\n\n');

        // Create a simplified prompt
        const fallbackPrompt = `
          Generate a brief plain HTML summary of the following information.
          Be concise and factual, focusing only on key points related to:
          ${data.planningOutput.enhancedQuery || data.planningOutput.originalQuery}

          Use simple tags like <h2>, <p>, <ul>, <li>, and <div> with minimal styling.
        `;

        // Initialize with simplified parameters
        const genAI = new GoogleGenerativeAI(context.GEMINI_API_KEY);
        const fallbackModel = genAI.getGenerativeModel({
          model: "gemini-1.5-pro",  // Fallback to an older, more stable model
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2000,
          },
        });

        const fallbackResponse = await fallbackModel.generateContentStream({
          contents: [
            { role: 'user', parts: [{ text: `${fallbackPrompt}\n\n${fallbackContent}` }] }
          ],
        });

        // Create streaming text response
        const streamingResponse = new StreamingTextResponse(fallbackResponse.stream);

        context.pushUpdateToClient({
          step: 4,
          type: "summarizing",
          payload: {
            loading: false,
            message: "Generated simplified summary (fallback mode)"
          }
        });

        return {
          summary: streamingResponse,
          generationComplete: true
        };
      } catch (fallbackError) {
        console.error("[MastraStep: SummarizeContentStep] Fallback summary generation failed:", fallbackError);
        throw fallbackError; // Let the caller handle this
      }
    };

    // Generate static error response when all else fails
    const generateErrorResponse = (error: any): {
      summary: StreamingTextResponse,
      generationComplete: boolean
    } => {
      console.log("[MastraStep: SummarizeContentStep] Generating static error response");

      // Create a static error response
      const errorHTML = `
        <div class="answer-container">
          <h2 class="text-xl font-bold mb-4 text-red-600">Error Generating Summary</h2>
          <p class="mb-2">We encountered an error while generating your summary: ${error instanceof Error ? error.message : "Unknown error"}</p>
          <p class="mb-2">Please try your search again or modify your query.</p>

          <h3 class="text-lg font-semibold mb-2">Information Found</h3>
          <div class="mb-6">
            <p class="mb-2">While we couldn't generate a complete summary, we did find relevant information. Here are a few excerpts:</p>
            <ul class="list-disc ml-5 mb-4">
              ${Array.isArray(data.relevantTexts)
                ? data.relevantTexts
                    .slice(0, 3)
                    .map(text => `<li>${text.substring(0, 200)}...</li>`)
                    .join('\n')
                : ''}
            </ul>
          </div>

          <p class="mb-2 text-sm text-gray-600">Error details: ${error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error"}</p>
        </div>
      `;

      // Create a simple static response for errors
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(errorHTML));
          controller.close();
        }
      });

      return {
        summary: new StreamingTextResponse(stream),
        generationComplete: false
      };
    };

    // Start the execution with retry mechanism
    return executeWithRetry();
  }
});

export default summarizeContentStep;