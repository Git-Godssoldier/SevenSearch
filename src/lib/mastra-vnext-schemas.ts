import { z } from 'zod';

/**
 * vNext Workflow Schemas
 * 
 * These schemas define the types used in the Mastra vNext workflow implementation.
 * They follow the vNext patterns for input/output schemas, with proper typing for
 * TypeScript inference.
 */

// User query input schema
export const userQueryInput = z.object({
  query: z.string().describe('The search query entered by the user'),
  searchId: z.string().describe('Unique identifier for this search session'),
  userId: z.string().describe('User ID for the current user'),
  session: z.any().describe('The session object containing user data'),
});

// Common types
export const searchResultItem = z.object({
  id: z.string().optional().describe('Unique ID for this search result'),
  url: z.string().describe('URL of the search result'),
  title: z.string().optional().describe('Title of the page or content'),
  snippet: z.string().optional().describe('Short snippet or summary of the content'),
  rawContent: z.string().optional().describe('Raw content if available'),
  score: z.number().optional().describe('Relevance score assigned by search provider'),
  provider: z.string().describe('Name of the search provider'),
  author: z.string().optional().describe('Author of the content'),
  publishedDate: z.string().optional().describe('Publication date as ISO string'),
  highlights: z.array(
    z.object({
      text: z.string().describe('Highlighted text passage'),
      score: z.number().describe('Relevance score for this highlight'),
    })
  ).optional().describe('Highlighted passages from the result'),
});

export const searchResults = z.array(searchResultItem);

// Step 1: Planning & Query Enhancement Schemas
export const planningInput = z.object({
  originalQuery: z.string().describe('The raw query entered by the user'),
});

export const planningOutput = z.object({
  enhancedQuery: z.string().describe('Query enhanced with additional context'),
  researchPlan: z.string().describe('Plan for researching the query'),
  subQuestions: z.array(z.string()).optional().describe('Sub-questions derived from the main query'),
});

// Step 2: Search Provider Schemas
export const searchProviderInput = z.object({
  enhancedQuery: z.string().describe('Enhanced query for better search results'),
  numResults: z.number().optional().describe('Number of results to request from provider'),
  subQuestions: z.array(z.string()).optional().describe('Sub-questions for multi-query search'),
});

export const searchProviderOutput = z.object({
  searchProvider: z.string().describe('Name of the search provider'),
  results: searchResults.describe('Search results from this provider'),
});

// Step 3: Aggregation & Deduplication Schemas
export const aggregationInput = z.object({
  exaResults: searchProviderOutput.describe('Results from Exa search provider'),
  jinaResults: searchProviderOutput.describe('Results from Jina AI search provider'),
  planningOutput: planningOutput.describe('Output from the planning step'),
});

export const aggregationOutput = z.object({
  aggregatedResults: searchResults.describe('Combined and deduplicated search results'),
});

// Step 4: Web Scraping Schemas
export const webScrapingInput = z.object({
  targetUrl: z.string().describe('URL to scrape content from'),
  originalQuery: z.string().describe('Original or enhanced query for context'),
});

export const webScrapingOutput = z.object({
  link: z.string().describe('URL that was scraped'),
  content: z.array(z.string()).describe('Extracted content chunks from the page'),
  error: z.boolean().optional().describe('Indicates if an error occurred during scraping'),
});

// Step 5: RAG - Embeddings & Semantic Search Schemas
export const ragInput = z.object({
  scrapedContents: z.array(webScrapingOutput).describe('Content scraped from target URLs'),
  enhancedQuery: z.string().describe('Enhanced query for semantic matching'),
  subQuestions: z.array(z.string()).optional().describe('Sub-questions for multi-query matching'),
});

export const ragOutput = z.object({
  relevantTexts: z.array(z.string()).describe('Most relevant text chunks for the query'),
});

// Step 6: Summary Generation Schemas
export const summaryInput = z.object({
  relevantTexts: z.array(z.string()).describe('Most relevant text chunks for generating summary'),
  planningOutput: planningOutput.describe('Planning output for context'),
});

export const summaryOutput = z.object({
  summary: z.any().describe('Generated summary as a ReadableStream'),
  generationComplete: z.boolean().describe('Indicates if generation is complete'),
});

// Workflow Output Schema
export const workflowOutput = z.object({
  summary: z.any().describe('Generated summary as a ReadableStream'),
  searchId: z.string().describe('ID of the search session'),
  metadata: z.record(z.string(), z.any()).optional().describe('Additional metadata about the search'),
});

// Event Schema for Streaming Updates
export const streamChunkOutput = z.object({
  step: z.number().describe('Step number in the workflow'),
  type: z.string().describe('Type of update (e.g., planning_enhancing, searching, error)'),
  payload: z.any().optional().describe('Additional data related to the update'),
  error: z.boolean().optional().describe('Indicates if this is an error update'),
  errorType: z.string().optional().describe('Type of error if applicable'),
});

// Deep Search branches
export const deepSearchInput = z.object({
  query: z.string().describe('Enhanced query for deep search'),
});

export const deepSearchOutput = z.object({
  results: searchResults.describe('Results from deep search'),
});

// Suspend and Resume Schemas
export const suspendSchema = z.object({
  reason: z.string().describe('Reason for suspension'),
  context: z.record(z.string(), z.any()).optional().describe('Context at suspension point'),
});

export const resumeSchema = z.object({
  action: z.string().describe('Action to take upon resumption'),
  context: z.record(z.string(), z.any()).optional().describe('Context for resumption'),
});

// Runtime Context Schema
export const runtimeContextSchema = z.object({
  GEMINI_API_KEY: z.string().optional(),
  SCRAPYBARA_API_KEY: z.string(),
  EXA_API_KEY: z.string(),
  FIRECRAWL_API_KEY: z.string().optional(),
  JINA_API_KEY: z.string(),
  userId: z.string(),
  searchId: z.string(),
});