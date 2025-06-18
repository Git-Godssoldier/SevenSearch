import { z } from 'zod';
import { createStep } from '../mastra-vnext-utils/step';
import { EventStreamWriter } from '../mastra-vnext-utils/stream-events';
import { CodeInterpreter } from '../utils/e2b-adapter.mjs';

/**
 * Content processing input schema
 */
const contentProcessingInputSchema = z.object({
  // Content can be a string or an array of strings (for multiple content blocks)
  content: z.union([
    z.string(),
    z.array(z.string())
  ]).describe('Content to process - either a single text block or an array of content blocks'),
  
  // Processing options
  options: z.object({
    // Processing mode determines the default code used for processing
    mode: z.enum(['clean', 'extract-entities', 'summarize', 'analyze', 'custom']).default('clean'),
    
    // Optional custom code to execute instead of predefined processing modes
    customCode: z.string().optional(),
    
    // Additional parameters for processing
    params: z.record(z.any()).optional(),
  }).optional().default({}),
  
  // Original source information for reference
  sourceInfo: z.object({
    url: z.string().optional(),
    title: z.string().optional(),
    type: z.string().optional(),
  }).optional(),
});

/**
 * Content processing output schema
 */
const contentProcessingOutputSchema = z.object({
  // Processed content result
  processedContent: z.union([
    z.string(),
    z.array(z.string()),
    z.record(z.any())
  ]).describe('Processed content - format depends on the processing mode'),
  
  // Metadata extracted during processing
  metadata: z.object({
    // Entity extraction results (if applicable)
    entities: z.array(z.object({
      type: z.string(),
      value: z.string(),
      confidence: z.number().optional(),
    })).optional(),
    
    // Content structure information
    structure: z.object({
      paragraphCount: z.number().optional(),
      sentenceCount: z.number().optional(),
      wordCount: z.number().optional(),
      headings: z.array(z.string()).optional(),
    }).optional(),
    
    // Content quality metrics
    quality: z.object({
      readability: z.number().optional(),
      informationDensity: z.number().optional(),
      relevanceScore: z.number().optional(),
    }).optional(),
  }).optional(),
  
  // Execution statistics
  stats: z.object({
    executionTime: z.number(),
    processingMode: z.string(),
  }),
});

/**
 * Default code templates for different processing modes
 */
const processingCodeTemplates: Record<string, string> = {
  'clean': `
    function cleanContent(content) {
      // Combine content if it's an array
      const textContent = Array.isArray(content) ? content.join('\\n\\n') : content;
      
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
    
    return cleanContent(providedData.content);
  `,
  
  'extract-entities': `
    function extractEntities(content) {
      // Combine content if it's an array
      const textContent = Array.isArray(content) ? content.join('\\n\\n') : content;
      
      // Simple regex-based entity extraction
      // In a real implementation, this would use a more sophisticated NER model
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
    
    return extractEntities(providedData.content);
  `,
  
  'summarize': `
    function summarizeContent(content) {
      // Combine content if it's an array
      const textContent = Array.isArray(content) ? content.join('\\n\\n') : content;
      
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
    
    return summarizeContent(providedData.content);
  `,
  
  'analyze': `
    function analyzeContent(content) {
      // Combine content if it's an array
      const textContent = Array.isArray(content) ? content.join('\\n\\n') : content;
      
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
    
    return analyzeContent(providedData.content);
  `,
  
  'custom': `
    // Custom processing function will be provided through options.customCode
    return null;
  `
};

/**
 * Content Processing Step
 * 
 * Processes content using E2B Code Interpreter for text cleaning, entity extraction,
 * summarization, analysis, or custom processing logic
 */
export const contentProcessingStep = createStep({
  id: 'content-processing-step',
  name: 'Content Processing',
  description: 'Processes text content using secure code execution for cleaning, analysis, or transformation',
  inputSchema: contentProcessingInputSchema,
  outputSchema: contentProcessingOutputSchema,
  
  async execute({ inputData, runtimeContext, emitter }) {
    const events = EventStreamWriter.createStepEventHelpers(emitter, 'content-processing-step');
    let sandbox: CodeInterpreter | null = null;
    
    try {
      const { content, options = {}, sourceInfo } = inputData;
      const { mode = 'clean', customCode, params = {} } = options;
      
      // Get API key from runtime context
      const apiKey = runtimeContext.get('E2B_API_KEY');
      
      if (!apiKey) {
        throw new Error('E2B_API_KEY is required in runtime context');
      }
      
      // Emit running status
      await events.emitRunning({
        message: `Starting content processing with mode: ${mode}`,
        contentType: Array.isArray(content) ? 'multiple blocks' : 'single block',
        sourceInfo,
      });
      
      // Emit progress update
      await events.emitProgress(10, 'Initializing E2B environment');
      
      // Initialize the sandbox
      sandbox = await CodeInterpreter.create({
        apiKey,
      });
      
      // Determine the code to execute
      const codeToExecute = customCode || processingCodeTemplates[mode];
      
      if (!codeToExecute) {
        throw new Error(`Invalid processing mode: ${mode}`);
      }
      
      // Prepare data for code execution
      const executionData = {
        content,
        params,
        sourceInfo,
      };
      
      // Emit progress update
      await events.emitProgress(30, `Executing ${mode} processing`);
      
      // Execute the processing code
      const startTime = Date.now();
      const execution = await sandbox.notebook.execCell(`
        const providedData = ${JSON.stringify(executionData)};
        ${codeToExecute}
      `);
      const executionTime = Date.now() - startTime;
      
      // Parse the result
      const resultText = execution.text || '{}';
      let result;
      
      try {
        // If the result is a valid JSON string, parse it
        result = JSON.parse(resultText);
      } catch (parseError) {
        // If not valid JSON, return the raw text
        result = {
          processedContent: resultText,
          metadata: {}
        };
      }
      
      // Emit progress update
      await events.emitProgress(90, 'Finalizing results');
      
      // Prepare final output
      const output = {
        processedContent: result.processedContent || resultText,
        metadata: result.metadata || {},
        stats: {
          executionTime,
          processingMode: mode,
        }
      };
      
      // Emit completed status
      await events.emitCompleted({
        message: `Content processing completed with mode: ${mode}`,
        executionTime,
        result: {
          contentType: typeof output.processedContent,
          metadataKeys: Object.keys(output.metadata),
        }
      });
      
      return output;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Content processing failed:', errorMessage);
      
      // Emit failed status
      await events.emitFailed('Content processing failed', errorMessage);
      
      // Return error result
      throw error;
      
    } finally {
      // Cleanup sandbox
      if (sandbox) {
        await sandbox.close();
      }
    }
  }
});

export default contentProcessingStep;