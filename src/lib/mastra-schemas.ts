import { z } from 'zod';

// User query input schema
export const UserQueryInputSchema = z.object({
  query: z.string(),
  searchId: z.string(),
  userId: z.string(),
  session: z.any(),
});

// Step 1: Planning & Query Enhancement
export const PlanningInputSchema = z.object({
  originalQuery: z.string(),
});

export const PlanningAndEnhancedQueryOutputSchema = z.object({
  enhancedQuery: z.string(),
  researchPlan: z.string(),
  subQuestions: z.array(z.string()).optional(),
});

// Step 2: Search Provider Input/Output
export const SearchProviderInputSchema = z.object({
  enhancedQuery: z.string(),
  numResults: z.number().optional(),
  subQuestions: z.array(z.string()).optional(),
});

export const IndividualSearchResultItemSchema = z.object({
  id: z.string().optional(),
  url: z.string(),
  title: z.string().optional(),
  snippet: z.string().optional(),
  rawContent: z.string().optional(),
  score: z.number().optional(),
  provider: z.string(),
  author: z.string().optional(),
  publishedDate: z.string().optional(),
  highlights: z.array(
    z.object({
      text: z.string(),
      score: z.number(),
    })
  ).optional(),
});

export const IndividualSearchResultsSchema = z.object({
  searchProvider: z.string(),
  results: z.array(IndividualSearchResultItemSchema),
});

// Step 3: Aggregation & Deduplication
export const AggregatedSearchResultsSchema = z.object({
  aggregatedResults: z.array(IndividualSearchResultItemSchema),
});

// Step 4: Web Scraping
export const WebScrapingInputSchema = z.object({
  targetUrl: z.string(),
  originalQuery: z.string(),
});

export const ExtractedPageContentOutputSchema = z.object({
  link: z.string(),
  content: z.array(z.string()),
  error: z.boolean().optional(),
});

// Step 5: RAG - Embeddings & Semantic Search
export const RAGInputSchema = z.object({
  scrapedContents: z.array(ExtractedPageContentOutputSchema),
  enhancedQuery: z.string(),
  subQuestions: z.array(z.string()).optional(),
});

export const RelevantChunksOutputSchema = z.object({
  relevantTexts: z.array(z.string()),
});

// Final Workflow Output
export const WorkflowOutputSchema = z.object({
  status: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Streaming Updates Schema
export const StreamChunkOutputSchema = z.object({
  step: z.number(),
  type: z.string(),
  payload: z.any().optional(),
  error: z.boolean().optional(),
  errorType: z.string().optional(),
});