/**
 * E2B - Scrapybara Integration Utilities
 * 
 * This file provides helper functions for integrating E2B Code Interpreter
 * with Scrapybara for advanced content extraction and processing.
 */

import { CodeInterpreter } from '@/lib/utils/e2b-adapter.mjs';
import type { ScrapybaraClient } from 'scrapybara';
import { EventEmitter } from 'events';
import { EventStreamWriter } from './stream-events';

/**
 * Interface for extracted content
 */
export interface ExtractedContent {
  url: string;
  title: string;
  content: string | string[];
  metadata?: Record<string, any>;
}

/**
 * Interface for processed content
 */
export interface ProcessedContent {
  url: string;
  title: string;
  processedContent: string | string[] | Record<string, any>;
  metadata?: Record<string, any>;
  stats?: {
    executionTime: number;
    processingMode: string;
  };
}

/**
 * ScrabybaraProcessor class
 * 
 * Combines Scrapybara for web content extraction with E2B for content processing
 */
export class ScrabybaraProcessor {
  private e2bSandbox: CodeInterpreter | null = null;
  private scrapybaraClient: ScrapybaraClient | null = null;
  private e2bApiKey: string;
  private isInitialized = false;
  private emitter: EventEmitter;
  private events: ReturnType<typeof EventStreamWriter.createStepEventHelpers>;

  /**
   * Create a new ScrabybaraProcessor
   * @param e2bApiKey E2B API key
   * @param scrapybaraClient Scrapybara client instance
   * @param emitter Event emitter for progress updates
   */
  constructor(e2bApiKey: string, scrapybaraClient: ScrapybaraClient | null = null, emitter?: EventEmitter) {
    this.e2bApiKey = e2bApiKey;
    this.scrapybaraClient = scrapybaraClient;
    this.emitter = emitter || new EventEmitter();
    this.events = EventStreamWriter.createStepEventHelpers(this.emitter, 'scrapybara-processor');
  }

  /**
   * Initialize the processor
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Initialize E2B sandbox
    this.e2bSandbox = await CodeInterpreter.create({
      apiKey: this.e2bApiKey,
    });
    
    // Emit initialization event
    if (this.events) {
      await this.events.emitCustom('e2b_initialized', {
        timestamp: new Date().toISOString()
      });
    }
    
    this.isInitialized = true;
  }

  /**
   * Extract content from a URL using Scrapybara
   * @param url URL to extract content from
   * @param instructions Instructions for extraction
   * @returns Extracted content
   */
  async extractContent(url: string, instructions: string): Promise<ExtractedContent> {
    if (!this.scrapybaraClient) {
      throw new Error('Scrapybara client not initialized');
    }
    
    // Emit event for starting extraction
    await this.events.emitCustom('extraction_started', {
      url,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Execute scraping with Scrapybara
      const response = await this.scrapybaraClient.act(url, instructions);
      
      // Basic parsing of the response
      const title = this.extractTitle(response) || url;
      const content = this.parseContent(response);
      
      // Emit event for successful extraction
      await this.events.emitCustom('extraction_completed', {
        url,
        contentLength: typeof content === 'string' ? content.length : content.length,
        timestamp: new Date().toISOString()
      });
      
      return {
        url,
        title,
        content,
        metadata: {
          extractionTime: new Date().toISOString()
        }
      };
    } catch (error) {
      // Emit event for extraction error
      await this.events.emitCustom('extraction_failed', {
        url,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  /**
   * Process extracted content using E2B
   * @param extractedContent Content extracted by Scrapybara
   * @param processingMode Processing mode ('clean', 'extract-entities', 'summarize', 'analyze', 'custom')
   * @param customCode Custom processing code (if mode is 'custom')
   * @returns Processed content
   */
  async processContent(
    extractedContent: ExtractedContent,
    processingMode: 'clean' | 'extract-entities' | 'summarize' | 'analyze' | 'custom' = 'clean',
    customCode?: string
  ): Promise<ProcessedContent> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.e2bSandbox) {
      throw new Error('E2B sandbox not initialized');
    }
    
    // Emit event for starting processing
    await this.events.emitCustom('processing_started', {
      url: extractedContent.url,
      mode: processingMode,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Prepare the content
      const content = Array.isArray(extractedContent.content)
        ? extractedContent.content.join('\n\n')
        : extractedContent.content;
      
      // Default processing code for different modes
      const processingCode = customCode || this.getProcessingCode(processingMode);
      
      // Process the content
      const startTime = Date.now();
      const execution = await this.e2bSandbox.notebook.execCell(`
        const content = ${JSON.stringify(content)};
        const url = ${JSON.stringify(extractedContent.url)};
        const title = ${JSON.stringify(extractedContent.title)};
        const metadata = ${JSON.stringify(extractedContent.metadata || {})};
        
        ${processingCode}
      `);
      const executionTime = Date.now() - startTime;
      
      // Parse the result
      let result: any = {};
      try {
        result = JSON.parse(execution.text || '{}');
      } catch (parseError) {
        result = {
          processedContent: execution.text || content,
          metadata: {}
        };
      }
      
      // Ensure the result has a processedContent field
      if (!result.processedContent) {
        result.processedContent = execution.text || content;
      }
      
      // Emit event for successful processing
      await this.events.emitCustom('processing_completed', {
        url: extractedContent.url,
        mode: processingMode,
        executionTime,
        timestamp: new Date().toISOString()
      });
      
      return {
        url: extractedContent.url,
        title: extractedContent.title,
        processedContent: result.processedContent,
        metadata: result.metadata || extractedContent.metadata || {},
        stats: {
          executionTime,
          processingMode
        }
      };
    } catch (error) {
      // Emit event for processing error
      await this.events.emitCustom('processing_failed', {
        url: extractedContent.url,
        mode: processingMode,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  /**
   * Get the appropriate processing code for a given mode
   * @param mode Processing mode
   * @returns JavaScript code for processing
   */
  private getProcessingCode(mode: string): string {
    switch (mode) {
      case 'clean':
        return `
          // Clean and normalize the content
          function cleanContent(input) {
            // Combine content if it's an array
            const textContent = Array.isArray(input) ? input.join('\\n\\n') : input;
            
            // Remove extra whitespace
            let cleanedText = textContent.replace(/\\s+/g, ' ');
            
            // Remove HTML tags
            cleanedText = cleanedText.replace(/<[^>]*>/g, '');
            
            // Fix common encoding issues
            cleanedText = cleanedText.replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'");
            
            // Split into paragraphs
            const paragraphs = cleanedText.split(/\\n{2,}/)
              .map(p => p.trim())
              .filter(p => p.length > 0);
            
            // Count words
            const wordCount = cleanedText.split(/\\s+/).filter(Boolean).length;
            
            return {
              processedContent: paragraphs,
              metadata: {
                structure: {
                  paragraphCount: paragraphs.length,
                  wordCount: wordCount
                }
              }
            };
          }
          
          cleanContent(content);
        `;
      
      case 'extract-entities':
        return `
          // Extract entities from the content
          function extractEntities(input) {
            // Combine content if it's an array
            const textContent = Array.isArray(input) ? input.join('\\n\\n') : input;
            
            // Simple regex-based entity extraction
            const entities = [];
            
            // Extract emails
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/g;
            const emails = textContent.match(emailRegex) || [];
            emails.forEach(email => {
              entities.push({ type: 'email', value: email, confidence: 0.9 });
            });
            
            // Extract URLs
            const urlRegex = /https?:\\/\\/[^\\s]+/g;
            const urls = textContent.match(urlRegex) || [];
            urls.forEach(url => {
              entities.push({ type: 'url', value: url, confidence: 0.9 });
            });
            
            // Extract dates
            const dateRegex = /\\b(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4}|\\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \\d{2,4})\\b/gi;
            const dates = textContent.match(dateRegex) || [];
            dates.forEach(date => {
              entities.push({ type: 'date', value: date, confidence: 0.8 });
            });
            
            return {
              processedContent: textContent,
              metadata: {
                entities: entities
              }
            };
          }
          
          extractEntities(content);
        `;
      
      case 'summarize':
        return `
          // Generate a summary of the content
          function summarizeContent(input) {
            // Combine content if it's an array
            const textContent = Array.isArray(input) ? input.join('\\n\\n') : input;
            
            // Simple extractive summarization
            // Split into sentences
            const sentences = textContent.match(/[^.!?]+[.!?]+/g) || [];
            
            // Score sentences based on position and length
            const scoredSentences = sentences.map((sentence, index) => {
              // Position score - sentences at the beginning are more important
              const positionScore = 1 - (index / sentences.length);
              
              // Length score - prefer medium-length sentences
              const words = sentence.split(/\\s+/).length;
              const lengthScore = words > 5 && words < 25 ? 1 : 0.5;
              
              return {
                text: sentence.trim(),
                score: positionScore * 0.6 + lengthScore * 0.4
              };
            });
            
            // Sort by score and take top 3 sentences or 20% of total, whichever is greater
            const numSentences = Math.max(3, Math.ceil(sentences.length * 0.2));
            const topSentences = scoredSentences
              .sort((a, b) => b.score - a.score)
              .slice(0, numSentences)
              // Sort back to original order
              .sort((a, b) => sentences.indexOf(a.text) - sentences.indexOf(b.text))
              .map(s => s.text);
            
            return {
              processedContent: topSentences.join(' '),
              metadata: {
                structure: {
                  sentenceCount: sentences.length,
                  summaryLength: topSentences.length
                }
              }
            };
          }
          
          summarizeContent(content);
        `;
      
      case 'analyze':
        return `
          // Analyze the content for structure and quality
          function analyzeContent(input) {
            // Combine content if it's an array
            const textContent = Array.isArray(input) ? input.join('\\n\\n') : input;
            
            // Calculate basic metrics
            const words = textContent.split(/\\s+/).filter(Boolean);
            const sentences = textContent.match(/[^.!?]+[.!?]+/g) || [];
            const paragraphs = textContent.split(/\\n{2,}/).filter(p => p.trim().length > 0);
            
            // Extract potential headings (capitalized text followed by newline)
            const headingRegex = /^[A-Z][A-Z0-9 ]+(?=\\n|$)/gm;
            const headings = textContent.match(headingRegex) || [];
            
            // Calculate readability (simplified Flesch-Kincaid)
            const avgWordsPerSentence = words.length / Math.max(1, sentences.length);
            const readabilityScore = Math.max(0, Math.min(100, 206.835 - (1.015 * avgWordsPerSentence)));
            
            // Calculate information density (avg word length as a simple proxy)
            const totalChars = words.reduce((sum, word) => sum + word.length, 0);
            const avgWordLength = totalChars / Math.max(1, words.length);
            const informationDensity = Math.min(1, avgWordLength / 10);
            
            return {
              processedContent: textContent,
              metadata: {
                structure: {
                  paragraphCount: paragraphs.length,
                  sentenceCount: sentences.length,
                  wordCount: words.length,
                  headings: headings
                },
                quality: {
                  readability: readabilityScore,
                  informationDensity: informationDensity
                }
              }
            };
          }
          
          analyzeContent(content);
        `;
      
      default:
        return `
          // Default processing - return content as is
          {
            processedContent: content,
            metadata: { 
              originalMetadata: metadata,
              url,
              title
            }
          }
        `;
    }
  }

  /**
   * Extract title from content
   * @param content Content to extract title from
   * @returns Extracted title or undefined
   */
  private extractTitle(content: string): string | undefined {
    // Look for a title in the format "# Title" or "## Title"
    const titleMatch = content.match(/^\s*#+\s*(.+?)(?:\n|$)/m);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim();
    }
    
    // Look for HTML title tag
    const htmlTitleMatch = content.match(/<title>(.*?)<\/title>/i);
    if (htmlTitleMatch && htmlTitleMatch[1]) {
      return htmlTitleMatch[1].trim();
    }
    
    // Return undefined if no title found
    return undefined;
  }

  /**
   * Parse content into paragraphs
   * @param content Content to parse
   * @returns Array of paragraphs
   */
  private parseContent(content: string): string[] {
    // Split by double newlines to get paragraphs
    const paragraphs = content
      .split(/\n{2,}/g)
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    return paragraphs.length > 0 ? paragraphs : [content];
  }

  /**
   * Close the processor and release resources
   */
  async close(): Promise<void> {
    if (this.e2bSandbox) {
      await this.e2bSandbox.close();
      this.e2bSandbox = null;
      this.isInitialized = false;
    }
  }
}

export default ScrabybaraProcessor;