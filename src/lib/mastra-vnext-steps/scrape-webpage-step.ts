import { z } from 'zod';
import { createStep } from '@mastra/core/workflows';
import axios from 'axios';
import {
  webScrapingInput,
  webScrapingOutput
} from '../mastra-vnext-schemas';
import { EventStreamWriter, EventType } from '../mastra-vnext-utils';

/**
 * ScrapybaraClient - Wrapper for Scrapybara's browser automation
 * Handles Claude-powered web page scraping and content extraction
 */
class ScrapybaraClient {
  private apiKey: string;
  private anthropicApiKey?: string;
  private baseUrl = 'https://api.scrapybara.com/v1';

  constructor(config: { apiKey: string; anthropicApiKey?: string }) {
    this.apiKey = config.apiKey;
    this.anthropicApiKey = config.anthropicApiKey;
  }

  /**
   * Perform controlled browser interaction and extract content
   */
  async act(
    url: string, 
    instructions: string, 
    options: {
      modelName?: string;
      temperature?: number;
      maxRetries?: number;
      maxTokens?: number;
      maxScrolls?: number;
      waitForSelectors?: string[];
      extractMetadata?: boolean;
    } = {}
  ): Promise<string> {
    const {
      modelName = 'claude-3-sonnet-20240229',
      temperature = 0.2,
      maxRetries = 2,
      maxTokens = 4000,
      maxScrolls = 5,
      waitForSelectors,
      extractMetadata = true
    } = options;

    // Configure request parameters
    const requestBody = {
      url,
      instructions,
      model: modelName,
      temperature,
      max_retries: maxRetries,
      max_tokens: maxTokens,
      max_scrolls: maxScrolls,
      wait_for_selectors: waitForSelectors,
      extract_metadata: extractMetadata,
      anthropic_api_key: this.anthropicApiKey
    };

    try {
      // Make API request
      const response = await axios.post(
        `${this.baseUrl}/scrape`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );

      // Check for error responses
      if (!response.data || !response.data.content) {
        throw new Error(response.data?.error || 'No content returned from scraping');
      }

      return response.data.content;
    } catch (error: any) {
      // Handle API errors
      if (error.response) {
        const statusCode = error.response.status;
        const errorMessage = error.response.data?.error || `HTTP error ${statusCode}`;
        throw new Error(`Scrapybara API error: ${errorMessage}`);
      }
      // Handle network errors
      if (error.request) {
        throw new Error(`Network error: ${error.message}`);
      }
      // Rethrow other errors
      throw error;
    }
  }
}

/**
 * Scrape Webpage Step
 * 
 * Uses Scrapybara to intelligently scrape web pages based on the query.
 * It employs Claude to navigate and extract relevant content from web pages.
 */
export const scrapeWebpageStep = createStep({
  id: 'scrape-webpage',
  description: 'Scrapes and extracts content from target web pages',
  inputSchema: webScrapingInput,
  outputSchema: webScrapingOutput,
  execute: async ({ inputData, runtimeContext, emitter }) => {
    // Create event helpers for this step
    const events = EventStreamWriter.createStepEventHelpers(emitter, 'scrape-webpage');

    try {
      const { targetUrl, originalQuery } = inputData;
      const { SCRAPYBARA_API_KEY, ANTHROPIC_API_KEY, searchId } = runtimeContext.getAll();

      // Validate the URL
      try {
        new URL(targetUrl);
      } catch (urlError) {
        throw new Error(`Invalid URL: ${targetUrl}`);
      }

      // Emit status update event - using both the standard event and our helpers for compatibility
      await emitter.emit('watch', {
        type: 'watch',
        payload: {
          currentStep: {
            id: 'scrape-webpage',
            status: 'running',
            payload: {
              link: targetUrl,
              status: "started"
            }
          }
        },
        eventTimestamp: new Date()
      });

      // Also emit with our helper
      await events.emitRunning({
        link: targetUrl,
        message: "Starting to scrape webpage"
      });

      // Emit custom event for link scraping started
      await events.emitCustom(EventType.LINK_SCRAPED, {
        url: targetUrl,
        status: 'started',
        query: originalQuery
      });

      // Verify API keys
      if (!SCRAPYBARA_API_KEY) {
        throw new Error("Missing Scrapybara API key");
      }

      // Initialize client
      const client = new ScrapybaraClient({
        apiKey: SCRAPYBARA_API_KEY,
        anthropicApiKey: ANTHROPIC_API_KEY
      });

      // Create comprehensive instructions for content extraction
      const instructions = generateScrapingInstructions(originalQuery || "");

      // Execute scraping with timeout and retry logic
      const timeoutMs = 45000; // 45 seconds
      const MAX_RETRIES = 2;

      let scrapedContent = "";
      let retryCount = 0;
      let lastError = null;

      // Emit progress update
      await events.emitProgress(10, "Starting scraping process");

      while (retryCount <= MAX_RETRIES) {
        try {
          // Emit progress update for attempt
          const progress = 10 + 30 * (retryCount / (MAX_RETRIES + 1));
          await events.emitProgress(progress, `Scraping attempt ${retryCount + 1}`);

          // Create a timeout promise
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Scraping operation timed out")), timeoutMs);
          });

          // Build the scrape options
          const scrapeOptions = {
            modelName: "claude-3-sonnet-20240229",
            temperature: 0.2,
            maxRetries: 1, // Scrapybara's internal retries
            maxTokens: 6000,
            maxScrolls: 5,
            waitForSelectors: ['article', '.content', '.post', 'main', '#content', '.article', 'body'],
            extractMetadata: true
          };

          // Race between scraping and timeout
          const scrapePromise = client.act(targetUrl, instructions, scrapeOptions);
          scrapedContent = await Promise.race([scrapePromise, timeoutPromise]);

          // If we got here, scraping succeeded
          await events.emitProgress(40, "Successfully scraped page content");
          break;

        } catch (error: any) {
          lastError = error;
          retryCount++;

          // Log retry attempt
          console.warn(`[Step: scrape-webpage] Retry ${retryCount}/${MAX_RETRIES} for ${targetUrl}: ${error.message}`);

          // Only retry if:
          // 1. We haven't exceeded max retries
          // 2. Error is retryable (timeout, network, or HTTP 5xx)
          const isRetryable =
            error.message.includes("timed out") ||
            error.message.includes("Network error") ||
            error.message.includes("HTTP error 5");

          if (retryCount > MAX_RETRIES || !isRetryable) {
            throw error;
          }

          // Emit retry event
          await events.emitCustom("scraping_retry", {
            retryCount,
            maxRetries: MAX_RETRIES,
            url: targetUrl,
            error: error.message
          });

          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      // If we had an error and exhausted retries, throw the last error
      if (!scrapedContent && lastError) {
        throw lastError;
      }

      // Emit progress update
      await events.emitProgress(60, "Processing extracted content");

      // Process the extracted content
      const contentBlocks = processScrapedContent(scrapedContent);

      // Emit progress update for completion
      await events.emitProgress(100, "Content extraction complete");

      // Emit completion event - using both for compatibility
      await emitter.emit('watch', {
        type: 'watch',
        payload: {
          currentStep: {
            id: 'scrape-webpage',
            status: 'completed',
            payload: {
              link: targetUrl,
              contentBlocks: contentBlocks.length,
              contentPreview: contentBlocks[0]?.substring(0, 100) + '...',
              status: "completed"
            }
          }
        },
        eventTimestamp: new Date()
      });

      // Also emit with our helper
      await events.emitCompleted({
        link: targetUrl,
        contentBlocks: contentBlocks.length,
        contentPreview: contentBlocks[0]?.substring(0, 100) + '...',
        status: "completed"
      });

      // Emit custom event for link scraping completed
      await events.emitCustom(EventType.LINK_SCRAPED, {
        url: targetUrl,
        status: 'completed',
        contentCount: contentBlocks.length,
        preview: contentBlocks[0]?.substring(0, 100) + '...'
      });

      return {
        link: targetUrl,
        content: contentBlocks,
        error: false
      };
    } catch (error) {
      console.error(`[Step: scrape-webpage] Error scraping webpage ${inputData.targetUrl}:`, error);

      // Emit error event using both approaches for compatibility
      await emitter.emit('watch', {
        type: 'watch',
        payload: {
          currentStep: {
            id: 'scrape-webpage',
            status: 'failed',
            payload: {
              link: inputData.targetUrl,
              status: "error",
              error: true,
              errorMessage: error instanceof Error ? error.message : "Unknown error during scraping"
            }
          }
        },
        eventTimestamp: new Date()
      });

      // Also emit with our helper
      await events.emitFailed(
        "Failed to scrape webpage",
        error instanceof Error ? error.message : "Unknown error"
      );

      // Emit custom event for link scraping failed
      await events.emitCustom(EventType.LINK_SCRAPED, {
        url: inputData.targetUrl,
        status: 'failed',
        error: error instanceof Error ? error.message : "Unknown error"
      });

      // Return minimal content to not break the pipeline
      return {
        link: inputData.targetUrl,
        content: [`Failed to extract content from ${inputData.targetUrl}. Error: ${error instanceof Error ? error.message : "Unknown error"}`],
        error: true
      };
    }
  }
});

/**
 * Generate detailed instructions for Claude scraping based on query
 */
function generateScrapingInstructions(query: string): string {
  return `
    You are a precise content extraction tool navigating a webpage to find the most relevant information.
    
    ${query ? `Your task is to extract content related to this query: "${query}"` : 'Your task is to extract the main content of this webpage'}
    
    Follow these extraction guidelines carefully:
    
    1. Identify and extract ONLY the most relevant 3-7 sections from the page
    2. Skip all navigation menus, headers, footers, sidebars, comments, and advertisements
    3. Extract complete, uninterrupted content blocks - don't truncate important information
    4. Maintain original formatting including headings, lists, and paragraph structure
    5. For each section, include the exact heading/title when available
    6. If tables contain relevant data, preserve them in markdown table format
    7. Limit to maximum 7 scrolls to find relevant content
    8. Look for main article content, FAQs, important lists, and key statistics
    9. For data-heavy pages, extract tables, charts (described), and key metrics
    10. Format output as clean markdown with proper section headings (## format)
    
    Return format:
    ## [Exact Section Title/Heading]
    Content text goes here maintaining original paragraphs, bullet points, etc.
    
    ## [Another Section Title]
    More content here...
    
    If no relevant content is found after thorough examination, explain what the page contains instead.
  `;
}

/**
 * Extract title from scraped content
 */
function extractTitle(content: string): string {
  // Look for first h1/h2 heading or first line
  const headingMatch = content.match(/^\s*#+\s*(.+?)(?:\n|$)/m);
  if (headingMatch && headingMatch[1]) {
    return headingMatch[1].trim();
  }
  
  // Fallback to first line if no heading found
  const firstLine = content.split(/\n/)[0];
  return firstLine ? firstLine.trim().replace(/^#+\s*/, '') : 'Untitled';
}

/**
 * Process and split scraped content into logical blocks
 */
function processScrapedContent(content: string): string[] {
  if (!content || content.trim().length === 0) {
    return ['No content was extracted from the page.'];
  }
  
  // Split content by markdown headings (## headings)
  let blocks = content
    .split(/(?=##\s)/g)
    .map(block => block.trim())
    .filter(block => block.length > 0);
  
  // If no markdown headings found, try to split by newlines
  if (blocks.length <= 1 && !blocks[0]?.startsWith('##')) {
    blocks = content
      .split(/\n{2,}/g)
      .map(block => block.trim())
      .filter(block => block.length > 0 && block.length < 5000); // Filter out empty blocks and extremely large blocks
  }
  
  // Ensure blocks aren't too long (for token limits in later steps)
  const processedBlocks: string[] = [];
  for (const block of blocks) {
    if (block.length <= 5000) {
      processedBlocks.push(block);
    } else {
      // Split very long blocks into smaller chunks
      const chunks = splitLongBlock(block);
      processedBlocks.push(...chunks);
    }
  }
  
  return processedBlocks;
}

/**
 * Split very long content blocks into smaller, logically separated chunks
 */
function splitLongBlock(block: string, maxChars = 4000): string[] {
  const chunks: string[] = [];
  
  // Try to split by paragraphs first
  const paragraphs = block.split(/\n{1,2}/g);
  
  let currentChunk = '';
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed limit, start a new chunk
    if (currentChunk.length + paragraph.length > maxChars) {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      // If a single paragraph is longer than maxChars, split it further
      if (paragraph.length > maxChars) {
        // Split by sentences
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        currentChunk = '';
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > maxChars) {
            if (currentChunk) {
              chunks.push(currentChunk);
            }
            // If a single sentence is too long, split arbitrarily
            if (sentence.length > maxChars) {
              for (let i = 0; i < sentence.length; i += maxChars) {
                chunks.push(sentence.substring(i, i + maxChars));
              }
            } else {
              currentChunk = sentence;
            }
          } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          }
        }
      } else {
        currentChunk = paragraph;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  // Add the last chunk if not empty
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

export default scrapeWebpageStep;