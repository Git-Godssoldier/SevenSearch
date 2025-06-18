/**
 * Mastra vNext Schemas
 * 
 * This file exports all schema definitions used in the Mastra vNext workflow system
 */

import { z } from 'zod';

// User query input schema
export const userQueryInput = z.object({
  query: z.string().min(1),
  searchId: z.string(),
  userId: z.string().optional(),
  session: z.any().optional(),
});

// Enhanced query type
export const enhancedQueryType = z.string();

// Planning input schema
export const planningInput = z.object({
  query: z.string().min(1),
});

// Planning output schema
export const planningOutput = z.object({
  enhancedQuery: z.string(),
  subQuestions: z.array(z.string()).optional(),
  plan: z.string().optional(),
});

// Search input schema
export const searchInput = z.object({
  query: z.string().min(1),
});

// Search output schema
export const searchOutput = z.object({
  results: z.array(z.any()),
});

// Exa search output schema
export const exaSearchOutput = z.object({
  results: z.array(z.any()),
});

// Web scraping input schema
export const webScrapingInput = z.object({
  targetUrl: z.string().url(),
  originalQuery: z.string().optional(),
});

// Web scraping output schema
export const webScrapingOutput = z.object({
  link: z.string(),
  content: z.array(z.string()),
  error: z.boolean().optional(),
});

// RAG input schema
export const ragInput = z.object({
  scrapedContents: z.array(z.any()),
  enhancedQuery: z.string(),
  subQuestions: z.array(z.string()).optional(),
});

// RAG output schema
export const ragOutput = z.object({
  relevantTexts: z.array(z.string()),
});

// Summary input schema
export const summaryInput = z.object({
  relevantTexts: z.array(z.string()),
  planningOutput: z.any(),
});

// Summary output schema
export const summaryOutput = z.object({
  summary: z.instanceof(ReadableStream),
  generationComplete: z.boolean(),
});

// Workflow output schema
export const workflowOutput = z.object({
  summary: z.instanceof(ReadableStream),
  searchId: z.string(),
  metadata: z.object({
    enhancedQuery: z.string(),
    searchPath: z.string(),
    generationComplete: z.boolean(),
  }),
});

// Stream chunk schema
export const streamChunkSchema = z.object({
  type: z.string().optional(),
  step: z.number().optional(),
  status: z.string().optional(),
  data: z.any().optional(),
  error: z.boolean().optional(),
  errorMessage: z.string().optional(),
  errorType: z.string().optional(),
});

// Stream chunk output schema
export const streamChunkOutput = streamChunkSchema;

// Import E2B integration schemas
import {
  contentProcessingInputSchema,
  contentProcessingOutputSchema,
  codeExecutionInputSchema,
  codeExecutionOutputSchema
} from './content-processing-schema';

// Export E2B integration schemas
export {
  contentProcessingInputSchema,
  contentProcessingOutputSchema,
  codeExecutionInputSchema,
  codeExecutionOutputSchema
};