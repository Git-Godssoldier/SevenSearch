import { z } from 'zod';
import { createStep, type WorkflowContext } from '../mastra-types';
import {
  RAGInputSchema,
  RelevantChunksOutputSchema,
  type StreamChunkOutputSchema,
  type ExtractedPageContentOutputSchema,
} from '../mastra-schemas';
import axios from 'axios';

/**
 * Cosine similarity calculation between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * RAG (Retrieval-Augmented Generation) Step
 * 
 * This step uses Jina embeddings to perform semantic search over
 * scraped content, finding the most relevant text chunks for a query.
 */
export const generateEmbeddingsAndSemanticSearchStep = createStep({
  name: 'GenerateEmbeddingsAndSemanticSearchStep',
  inputSchema: RAGInputSchema,
  outputSchema: RelevantChunksOutputSchema,
  async execute({ data, context }: { data: z.infer<typeof RAGInputSchema>, context: WorkflowContext }) {
    const { enhancedQuery, subQuestions, scrapedContents } = data;
    const { pushUpdateToClient, searchId, userId } = context;

    console.log(`[MastraStep: ${this.name}] Started for searchId: ${searchId}`);
    pushUpdateToClient({
      step: 4, 
      type: 'rag_started',
      payload: { message: `Starting RAG process for ${scrapedContents.length} documents.` },
    });

    // Create search-specific vector store for this operation
    // This is per-search so we don't need persistence across queries
    const vectorStore: Array<{
      id: string;
      text: string;
      embedding: number[];
      metadata: {
        url: string;
        title?: string;
        sourceIndex: number;
      };
    }> = [];

    // Configuration for Jina.ai Embeddings API
    const { JINA_API_KEY } = context;
    const JINA_EMBEDDINGS_API = "https://api.jina.ai/v1/embeddings";
    const headers = {
      "Authorization": `Bearer ${JINA_API_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    };

    // Process document content and generate embeddings
    for (const doc of scrapedContents) {
      // Process content blocks in batches to optimize API calls
      const contentBlocks = doc.content.filter(block => block.trim().length > 0);
      if (contentBlocks.length === 0) continue;

      try {
        // Use Jina's embeddings API to generate embeddings for all content blocks at once
        const response = await axios.post(JINA_EMBEDDINGS_API, {
          model: "jina-embeddings-v3",
          input: contentBlocks,
          task: "retrieval.passage", // Optimized for document content
          dimensions: 1024 // Full dimension for maximum quality
        }, { headers });

        // Extract embeddings from response and add to vector store
        if (response.data && response.data.data) {
          response.data.data.forEach((item: any, index: number) => {
            vectorStore.push({
              id: `${doc.link}#${vectorStore.length}`,
              text: contentBlocks[index],
              embedding: item.embedding,
              metadata: {
                url: doc.link,
                title: doc.link,
                sourceIndex: index
              },
            });
          });
        }
      } catch (error) {
        console.error(`[MastraStep: ${this.name}] Error generating embedding for content from ${doc.url}:`, error);
        // Continue with other documents even if one fails
      }
    }

    console.log(`[MastraStep: ${this.name}] Generated ${vectorStore.length} embeddings for content blocks.`);
    
    // Send update to client
    pushUpdateToClient({
      step: 4,
      type: 'embeddings_generated',
      payload: { count: vectorStore.length },
    });

    // If no embeddings were generated, return empty result
    if (vectorStore.length === 0) {
      console.warn(`[MastraStep: ${this.name}] No content embeddings generated, returning empty result.`);
      return {
        relevantTexts: [],
      };
    }

    // Generate embeddings for the query and subquestions
    const queryTexts = [enhancedQuery, ...(subQuestions || []).slice(0, 3)];
    let queryEmbeddings: number[][] = [];
    
    try {
      // Use Jina's embeddings API with query-specific parameters
      const queryResponse = await axios.post(JINA_EMBEDDINGS_API, {
        model: "jina-embeddings-v3",
        input: queryTexts,
        task: "retrieval.query", // Optimized for search queries
        dimensions: 1024
      }, { headers });

      if (queryResponse.data && queryResponse.data.data) {
        queryEmbeddings = queryResponse.data.data.map((item: any) => item.embedding);
      } else {
        throw new Error("Invalid response from Jina embeddings API");
      }
    } catch (error) {
      console.error(`[MastraStep: ${this.name}] Error generating query embeddings:`, error);
      
      // Fallback to main query only with a random embedding if needed
      queryEmbeddings = [Array(1024).fill(0).map(() => Math.random())];
      
      // Send error update but continue with fallback
      pushUpdateToClient({
        step: 4,
        type: 'warning',
        payload: {
          message: 'Failed to generate proper query embeddings, using fallback approach',
          error: error instanceof Error ? error.message : String(error)
        }
      });
    }

    // Configuration for similarity search
    const similarityThreshold = 0.65; // Lower threshold to ensure we get enough relevant content
    const topK = 8; // Get more chunks to ensure comprehensive coverage
    const uniqueUrls = new Set<string>();
    const allRelevantChunks: Array<{text: string, url: string, similarity: number}> = [];

    // Perform similarity search for each query embedding
    for (const queryEmbedding of queryEmbeddings) {
      // Calculate similarity scores for all vectors
      const scoredResults = vectorStore.map(vector => ({
        text: vector.text,
        url: vector.metadata.url,
        similarity: cosineSimilarity(queryEmbedding, vector.embedding),
      }));

      // Sort by similarity score (highest first)
      scoredResults.sort((a, b) => b.similarity - a.similarity);
      
      // Add top results to all relevant chunks
      const topResults = scoredResults
        .filter(result => result.similarity >= similarityThreshold)
        .slice(0, topK);
        
      allRelevantChunks.push(...topResults);
      
      // Track unique sources
      topResults.forEach(result => uniqueUrls.add(result.url));
    }

    // De-duplicate and select most relevant chunks
    const deduplicatedChunks: string[] = [];
    const seenTexts = new Set<string>();
    
    // Sort all chunks by similarity
    allRelevantChunks.sort((a, b) => b.similarity - a.similarity);
    
    // Take top unique chunks
    for (const chunk of allRelevantChunks) {
      // Normalize text for deduplication (lowercase, trim whitespace)
      const normalizedText = chunk.text.toLowerCase().trim();
      
      // Skip if we've seen this text before
      if (seenTexts.has(normalizedText)) continue;
      
      // Add to results
      deduplicatedChunks.push(chunk.text);
      seenTexts.add(normalizedText);
      
      // Limit to top 10 chunks for performance
      if (deduplicatedChunks.length >= 10) break;
    }

    console.log(`[MastraStep: ${this.name}] Found ${deduplicatedChunks.length} relevant text chunks from ${uniqueUrls.size} sources.`);

    // Log usage information for tracking and monitoring
    const tokenUsage = {
      contentEmbeddings: vectorStore.length * 1000, // Approximate tokens for content
      queryEmbeddings: queryTexts.length * 100, // Approximate tokens for queries
      totalTokens: vectorStore.length * 1000 + queryTexts.length * 100
    };

    pushUpdateToClient({
      step: 4,
      type: 'semantic_search_completed',
      payload: {
        count: deduplicatedChunks.length,
        sources: uniqueUrls.size,
        usage: tokenUsage
      },
    });

    return {
      relevantTexts: deduplicatedChunks,
    };
  },
});