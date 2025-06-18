import { z } from 'zod';
import { createStep } from '@mastra/core/workflows';
import axios from 'axios';
import {
  ragInput,
  ragOutput
} from '../mastra-vnext-schemas';
import { EventStreamWriter, EventType } from '../mastra-vnext-utils';

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
 * RAG (Retrieval-Augmented Generation) Step for Mastra vNext
 * 
 * This step uses Jina embeddings API to perform semantic search over
 * scraped content chunks, finding the most relevant text for the search query.
 * 
 * Event handling is done through the vNext emitter pattern for consistent
 * event streaming to the client.
 */
export const ragStep = createStep({
  id: 'rag-step',
  description: 'Generates embeddings and performs semantic search on scraped content',
  inputSchema: ragInput,
  outputSchema: ragOutput,
  async execute({ inputData, runtimeContext, emitter }) {
    // Create event helpers for standardized event emission
    const events = EventStreamWriter.createStepEventHelpers(emitter, 'rag-step');
    
    try {
      const { enhancedQuery, subQuestions, scrapedContents } = inputData;
      const { JINA_API_KEY, searchId, userId } = runtimeContext.getAll();
      
      console.log(`[Step: rag-step] Started for searchId: ${searchId}`);
      
      // Emit running status event
      await events.emitRunning({ 
        message: `Starting RAG process for ${scrapedContents.length} documents`,
        documentCount: scrapedContents.length
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
      const JINA_EMBEDDINGS_API = "https://api.jina.ai/v1/embeddings";
      const headers = {
        "Authorization": `Bearer ${JINA_API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      };
      
      // Emit progress update for starting embeddings generation
      await events.emitProgress(10, "Starting embeddings generation");

      // Process document content and generate embeddings
      let processedDocs = 0;
      for (const doc of scrapedContents) {
        // Skip if document has no content
        const contentBlocks = doc.content.filter(block => block.trim().length > 0);
        if (contentBlocks.length === 0) continue;

        try {
          // Emit custom event for processing specific document
          await events.emitCustom(EventType.PROGRESS_UPDATE, {
            message: `Processing document ${++processedDocs}/${scrapedContents.length}`,
            url: doc.link
          });
          
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
                  title: doc.link.split('/').pop() || doc.link,
                  sourceIndex: index
                },
              });
            });
            
            // Update progress based on documents processed
            const progress = 10 + Math.floor((processedDocs / scrapedContents.length) * 40);
            await events.emitProgress(progress, 
              `Generated embeddings for ${vectorStore.length} content blocks`);
          }
        } catch (error) {
          console.error(`[Step: rag-step] Error generating embedding for content from ${doc.link}:`, error);
          // Emit custom event for embedding error
          await events.emitCustom(EventType.WARNING, {
            message: `Failed to generate embeddings for document ${doc.link}`,
            error: error instanceof Error ? error.message : String(error)
          });
          // Continue with other documents even if one fails
        }
      }

      console.log(`[Step: rag-step] Generated ${vectorStore.length} embeddings for content blocks.`);
      
      // Emit event for embeddings generation completion
      await events.emitCustom("embeddings_generated", { 
        count: vectorStore.length,
        documentCount: scrapedContents.length
      });
      
      // Update progress
      await events.emitProgress(50, "Embeddings generated, starting semantic search");

      // If no embeddings were generated, return empty result
      if (vectorStore.length === 0) {
        console.warn(`[Step: rag-step] No content embeddings generated, returning empty result.`);
        await events.emitCompleted({ 
          relevantTextCount: 0,
          message: "No content embeddings could be generated"
        });
        return {
          relevantTexts: [],
        };
      }

      // Generate embeddings for the query and subquestions
      const queryTexts = [enhancedQuery, ...(subQuestions || []).slice(0, 3)];
      let queryEmbeddings: number[][] = [];
      
      try {
        // Emit progress update
        await events.emitProgress(60, "Generating query embeddings");
        
        // Use Jina's embeddings API with query-specific parameters
        const queryResponse = await axios.post(JINA_EMBEDDINGS_API, {
          model: "jina-embeddings-v3",
          input: queryTexts,
          task: "retrieval.query", // Optimized for search queries
          dimensions: 1024
        }, { headers });

        if (queryResponse.data && queryResponse.data.data) {
          queryEmbeddings = queryResponse.data.data.map((item: any) => item.embedding);
          
          // Emit custom event for query embeddings
          await events.emitCustom("query_embeddings_generated", {
            count: queryEmbeddings.length,
            queries: queryTexts.map(q => q.substring(0, 50) + (q.length > 50 ? '...' : ''))
          });
        } else {
          throw new Error("Invalid response from Jina embeddings API");
        }
      } catch (error) {
        console.error(`[Step: rag-step] Error generating query embeddings:`, error);
        
        // Fallback to main query only with a random embedding if needed
        queryEmbeddings = [Array(1024).fill(0).map(() => Math.random())];
        
        // Emit warning event but continue with fallback
        await events.emitCustom(EventType.WARNING, {
          message: 'Failed to generate proper query embeddings, using fallback approach',
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Emit progress update
      await events.emitProgress(70, "Running semantic search");
      
      // Configuration for similarity search
      const similarityThreshold = 0.65; // Lower threshold to ensure we get enough relevant content
      const topK = 8; // Get more chunks to ensure comprehensive coverage
      const uniqueUrls = new Set<string>();
      const allRelevantChunks: Array<{text: string, url: string, similarity: number}> = [];

      // Perform similarity search for each query embedding
      for (let i = 0; i < queryEmbeddings.length; i++) {
        const queryEmbedding = queryEmbeddings[i];
        const queryText = queryTexts[i];
        
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
        
        // Emit custom event for query results
        await events.emitCustom(EventType.RESULTS_FOUND, {
          query: queryText.substring(0, 50) + (queryText.length > 50 ? '...' : ''),
          resultCount: topResults.length,
          queryIndex: i
        });
      }

      // Emit progress update
      await events.emitProgress(85, "Deduplicating results");
      
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

      console.log(`[Step: rag-step] Found ${deduplicatedChunks.length} relevant text chunks from ${uniqueUrls.size} sources.`);

      // Log usage information for tracking and monitoring
      const tokenUsage = {
        contentEmbeddings: vectorStore.length * 1000, // Approximate tokens for content
        queryEmbeddings: queryTexts.length * 100, // Approximate tokens for queries
        totalTokens: vectorStore.length * 1000 + queryTexts.length * 100
      };

      // Emit completion event with all relevant info
      await events.emitProgress(100, "Semantic search completed");
      await events.emitCompleted({
        relevantTextCount: deduplicatedChunks.length,
        sourceCount: uniqueUrls.size,
        usage: tokenUsage
      });

      return {
        relevantTexts: deduplicatedChunks,
      };
    } catch (error) {
      console.error(`[Step: rag-step] Error during semantic search:`, error);
      
      // Emit failure event
      await events.emitFailed(
        "Failed to perform semantic search on content",
        error instanceof Error ? error.message : String(error)
      );
      
      // Return empty result to allow workflow to continue
      return {
        relevantTexts: [],
      };
    }
  },
});