import { z } from 'zod';

/**
 * Schema for content processing input
 */
export const contentProcessingInputSchema = z.object({
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
 * Schema for extracted entity
 */
export const entitySchema = z.object({
  type: z.string(),
  value: z.string(),
  confidence: z.number().optional(),
});

/**
 * Schema for content structure metadata
 */
export const contentStructureSchema = z.object({
  paragraphCount: z.number().optional(),
  sentenceCount: z.number().optional(),
  wordCount: z.number().optional(),
  headings: z.array(z.string()).optional(),
});

/**
 * Schema for content quality metrics
 */
export const contentQualitySchema = z.object({
  readability: z.number().optional(),
  informationDensity: z.number().optional(),
  relevanceScore: z.number().optional(),
});

/**
 * Schema for content processing output
 */
export const contentProcessingOutputSchema = z.object({
  // Processed content result
  processedContent: z.union([
    z.string(),
    z.array(z.string()),
    z.record(z.any())
  ]).describe('Processed content - format depends on the processing mode'),
  
  // Metadata extracted during processing
  metadata: z.object({
    // Entity extraction results (if applicable)
    entities: z.array(entitySchema).optional(),
    
    // Content structure information
    structure: contentStructureSchema.optional(),
    
    // Content quality metrics
    quality: contentQualitySchema.optional(),
  }).optional(),
  
  // Execution statistics
  stats: z.object({
    executionTime: z.number(),
    processingMode: z.string(),
  }),
});

/**
 * Schema for code execution input
 */
export const codeExecutionInputSchema = z.object({
  code: z.string().min(1).describe('JavaScript code to execute in the E2B sandbox'),
  data: z.any().optional().describe('Optional data to be used by the code'),
  options: z.object({
    timeout: z.number().min(1000).max(60000).optional().default(30000),
    memoryLimit: z.number().optional(),
    allowedPackages: z.array(z.string()).optional(),
  }).optional().default({}),
});

/**
 * Schema for code execution output
 */
export const codeExecutionOutputSchema = z.object({
  result: z.any().describe('Result returned by the executed code'),
  executionTime: z.number().describe('Time taken to execute the code in milliseconds'),
  output: z.string().describe('Any console output from the code execution'),
  error: z.string().nullable().describe('Error message if execution failed'),
});

// Export all schemas as a named object to avoid the anonymous default export warning
const contentProcessingSchemas = {
  contentProcessingInputSchema,
  contentProcessingOutputSchema,
  codeExecutionInputSchema,
  codeExecutionOutputSchema,
  entitySchema,
  contentStructureSchema,
  contentQualitySchema
};

export default contentProcessingSchemas;