import { z } from 'zod';
import { createStep, type WorkflowContext } from '../mastra-types';
import axios from 'axios';
import {
  IndividualSearchResultsSchema,
  PlanningAndEnhancedQueryOutputSchema,
  type IndividualSearchResultItemSchema,
  type StreamChunkOutputSchema
} from '../mastra-schemas';

// Input schema for this step
const AggregateStepInputSchema = z.object({
  exaResults: IndividualSearchResultsSchema.optional(),
  jinaResults: IndividualSearchResultsSchema.optional(),
  firecrawlResults: IndividualSearchResultsSchema.optional(),
  planningOutput: PlanningAndEnhancedQueryOutputSchema
});

// Output schema for aggregated results
const AggregateStepOutputSchema = z.object({
  aggregatedResults: z.array(z.object({
    id: z.string().optional(),
    url: z.string().url(),
    title: z.string().optional(),
    snippet: z.string().optional(),
    rawContent: z.string().optional(),
    score: z.number().optional(),
    provider: z.string(),
    author: z.string().optional(),
    publishedDate: z.string().optional(),
    clusters: z.array(z.string()).optional(),
    highlights: z.array(z.object({
      text: z.string(),
      score: z.number()
    })).optional()
  })),
  sourceStats: z.object({
    totalProviders: z.number(),
    exa: z.number().optional(),
    jina: z.number().optional(),
    firecrawl: z.number().optional(),
    deduplicatedCount: z.number(),
    topicClusters: z.record(z.string(), z.number()).optional()
  })
});

/**
 * Aggregates and deduplicates search results from multiple providers,
 * with advanced capabilities for semantic deduplication, result merging,
 * and relevance-based reranking.
 */
export const aggregateAndDeduplicateSearchResultsStep = createStep({
  name: 'AggregateAndDeduplicateSearchResultsStep',
  inputSchema: AggregateStepInputSchema,
  outputSchema: AggregateStepOutputSchema,
  async execute({ data, context }: { data: z.infer<typeof AggregateStepInputSchema>, context: WorkflowContext }) {
    try {
      const { exaResults, jinaResults, firecrawlResults, planningOutput } = data;
      const { JINA_API_KEY, pushUpdateToClient, searchId, userId } = context;

      console.log(`[MastraStep: ${this.name}] Started for searchId: ${searchId}`);
      pushUpdateToClient({
        step: 2,
        type: 'aggregating_results',
        payload: { message: 'Combining search results from multiple sources...' },
      });

      // Collect all results and tag their source
      const allResults: z.infer<typeof IndividualSearchResultItemSchema>[] = [];

      // Add results from each provider if available, ensuring proper source tagging
      if (exaResults && exaResults.results) {
        const taggedExaResults = exaResults.results.map(result => ({
          ...result,
          provider: result.provider || 'exa'
        }));
        allResults.push(...taggedExaResults);
      }

      if (jinaResults && jinaResults.results) {
        const taggedJinaResults = jinaResults.results.map(result => ({
          ...result,
          provider: result.provider || 'jina'
        }));
        allResults.push(...taggedJinaResults);
      }

      if (firecrawlResults && firecrawlResults.results) {
        const taggedFirecrawlResults = firecrawlResults.results.map(result => ({
          ...result,
          provider: result.provider || 'firecrawl'
        }));
        allResults.push(...taggedFirecrawlResults);
      }

      // Early exit if no results
      if (allResults.length === 0) {
        console.log(`[MastraStep: ${this.name}] No results to aggregate`);
        return {
          aggregatedResults: [],
          sourceStats: {
            totalProviders: 0,
            exa: 0,
            jina: 0,
            firecrawl: 0,
            deduplicatedCount: 0
          }
        };
      }

      // Normalize URLs for better matching
      const normalizeUrl = (url: string): string => {
        try {
          // Remove trailing slashes, query parameters, and fragments
          let normalized = url.trim().toLowerCase();

          // Remove protocol
          normalized = normalized.replace(/^https?:\/\//, '');

          // Remove www prefix
          normalized = normalized.replace(/^www\./, '');

          // Remove trailing slash
          normalized = normalized.replace(/\/$/, '');

          // Remove query parameters and fragments
          normalized = normalized.split(/[?#]/)[0];

          return normalized;
        } catch (e) {
          return url; // Return original URL if normalization fails
        }
      };

      // First pass: collect unique URLs and merge duplicates using normalized URLs
      const urlToResultMap = new Map<string, z.infer<typeof IndividualSearchResultItemSchema>>();
      const originalCount = allResults.length;

      // Keep track of original URLs for each normalized URL
      const normalizedToOriginalUrls = new Map<string, Set<string>>();

      // Initial URL-based deduplication
      for (const result of allResults) {
        // Ensure URL exists and is valid
        if (!result.url || result.url.trim() === '') {
          continue; // Skip results without valid URLs
        }

        const originalUrl = result.url;
        const normalizedUrl = normalizeUrl(originalUrl);

        // Store mapping from normalized to original URLs
        if (!normalizedToOriginalUrls.has(normalizedUrl)) {
          normalizedToOriginalUrls.set(normalizedUrl, new Set());
        }
        normalizedToOriginalUrls.get(normalizedUrl)?.add(originalUrl);

        if (urlToResultMap.has(normalizedUrl)) {
          // Merge with existing result using enhanced merging strategy
          mergeResultWithExisting(urlToResultMap.get(normalizedUrl)!, result);
        } else {
          // New unique URL
          urlToResultMap.set(normalizedUrl, {...result});
        }
      }

      // Function to merge results intelligently
      function mergeResultWithExisting(
        existingResult: z.infer<typeof IndividualSearchResultItemSchema>,
        newResult: z.infer<typeof IndividualSearchResultItemSchema>
      ): void {
        // Keep the highest score (if available)
        if (newResult.score && (!existingResult.score || newResult.score > existingResult.score)) {
          existingResult.score = newResult.score;
        }

        // Choose the longer/better title if available
        if (newResult.title) {
          if (!existingResult.title || (
            newResult.title.length > existingResult.title.length &&
            !existingResult.title.includes(newResult.title)
          )) {
            existingResult.title = newResult.title;
          }
        }

        // Choose the longer/better snippet if available
        if (newResult.snippet) {
          if (!existingResult.snippet ||
              newResult.snippet.length > existingResult.snippet.length * 1.5) {
            existingResult.snippet = newResult.snippet;
          } else if (existingResult.snippet &&
                     newResult.snippet.length > 50 &&
                     !existingResult.snippet.includes(newResult.snippet)) {
            // Combine non-overlapping snippets
            existingResult.snippet = `${existingResult.snippet} ${newResult.snippet}`;
          }
        }

        // Combine highlights if both have them
        if (newResult.highlights && existingResult.highlights) {
          const existingTexts = new Set(existingResult.highlights.map(h => h.text));
          const newHighlights = newResult.highlights.filter(h => !existingTexts.has(h.text));
          existingResult.highlights = [...existingResult.highlights, ...newHighlights];

          // Sort highlights by score (highest first)
          existingResult.highlights.sort((a, b) => b.score - a.score);

          // Limit to top 5 highlights to avoid overwhelming
          if (Array.isArray(existingResult.highlights) && existingResult.highlights.length > 5) {
            existingResult.highlights = existingResult.highlights.slice(0, 5);
          }
        } else if (newResult.highlights) {
          existingResult.highlights = newResult.highlights;
        }

        // Combine providers
        if (newResult.provider && existingResult.provider !== newResult.provider) {
          const providers = new Set((existingResult.provider || "").split(",")
            .concat((newResult.provider || "").split(","))
            .filter(p => p.trim() !== ""));
          existingResult.provider = Array.from(providers).join(",");
        }

        // Choose the better rawContent
        if (newResult.rawContent && (!existingResult.rawContent ||
            newResult.rawContent.length > existingResult.rawContent.length * 1.2)) {
          existingResult.rawContent = newResult.rawContent;
        }

        // Choose the better author information
        if (newResult.author && !existingResult.author) {
          existingResult.author = newResult.author;
        }

        // Choose the more recent publishedDate if available
        if (newResult.publishedDate && existingResult.publishedDate) {
          try {
            const newDate = new Date(newResult.publishedDate);
            const existingDate = new Date(existingResult.publishedDate);
            if (newDate > existingDate) {
              existingResult.publishedDate = newResult.publishedDate;
            }
          } catch (e) {
            // If date parsing fails, keep the existing date
          }
        } else if (newResult.publishedDate) {
          existingResult.publishedDate = newResult.publishedDate;
        }
      }

      // Convert map to array
      let dedupedResults = Array.from(urlToResultMap.values());

      // Track associated URLs for each result
      dedupedResults.forEach(result => {
        const normalized = normalizeUrl(result.url);
        const associatedUrls = normalizedToOriginalUrls.get(normalized);

        if (associatedUrls && associatedUrls.size > 1) {
          // Store associated URLs as a property on the result
          (result as any).associatedUrls = Array.from(associatedUrls);
        }
      });

      // Content-based near-duplicate detection (for results with significantly overlapping content)
      if (dedupedResults.length > 1) {
        pushUpdateToClient({
          step: 2,
          type: 'aggregating_results',
          payload: { message: 'Detecting content duplicates...' },
        });

        try {
          // Create clusters of similar content
          const contentClusters = detectContentDuplicates(dedupedResults);

          // Merge results within each cluster
          const mergedResults: z.infer<typeof IndividualSearchResultItemSchema>[] = [];
          const processedIndices = new Set<number>();

          // Process each cluster
          contentClusters.forEach(cluster => {
            if (cluster.length <= 1) {
              // Single item clusters don't need merging
              if (cluster.length === 1 && !processedIndices.has(cluster[0])) {
                mergedResults.push(dedupedResults[cluster[0]]);
                processedIndices.add(cluster[0]);
              }
              return;
            }

            // For multi-item clusters, merge all items
            const clusterIndices = cluster.filter(idx => !processedIndices.has(idx));

            if (clusterIndices.length > 0) {
              // Start with the highest scored item as base
              const baseIndex = clusterIndices.reduce((maxIdx, idx) => {
                const maxScore = dedupedResults[maxIdx]?.score || 0;
                const currentScore = dedupedResults[idx]?.score || 0;
                return currentScore > maxScore ? idx : maxIdx;
              }, clusterIndices[0]);

              const mergedResult = {...dedupedResults[baseIndex]};

              // Merge all other items in the cluster into the base item
              clusterIndices.forEach(idx => {
                if (idx !== baseIndex) {
                  mergeResultWithExisting(mergedResult, dedupedResults[idx]);
                }
                processedIndices.add(idx);
              });

              // Add cluster info to the merged result
              (mergedResult as any).clusters = cluster.map(idx => dedupedResults[idx].url);

              mergedResults.push(mergedResult);
            }
          });

          // Add any unprocessed results
          dedupedResults.forEach((result, idx) => {
            if (!processedIndices.has(idx)) {
              mergedResults.push(result);
            }
          });

          dedupedResults = mergedResults;
        } catch (error) {
          console.error(`[MastraStep: ${this.name}] Error during content clustering:`, error);
          // Continue with URL-based deduplication only
        }
      }

      // Function to detect content duplicates
      function detectContentDuplicates(
        results: z.infer<typeof IndividualSearchResultItemSchema>[]
      ): number[][] {
        // Function to compute Jaccard similarity between two documents
        function jaccardSimilarity(a: string, b: string): number {
          // Extract trigrams (3-character sequences) from strings
          const extractTrigrams = (text: string): Set<string> => {
            const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
            const trigrams = new Set<string>();
            for (let i = 0; i < normalized.length - 2; i++) {
              trigrams.add(normalized.substring(i, i + 3));
            }
            return trigrams;
          };

          const trigramsA = extractTrigrams(a);
          const trigramsB = extractTrigrams(b);

          // Early exit for performance
          if (trigramsA.size === 0 || trigramsB.size === 0) {
            return 0;
          }

          // Find intersection size
          let intersection = 0;
          for (const trigram of trigramsA) {
            if (trigramsB.has(trigram)) {
              intersection++;
            }
          }

          // Calculate Jaccard similarity
          const union = trigramsA.size + trigramsB.size - intersection;
          return union > 0 ? intersection / union : 0;
        }

        // Build content for comparison - prioritize snippet over title
        const contents = results.map(r => r.snippet || r.title || '');

        // Build similarity matrix
        const similarityMatrix: number[][] = [];
        for (let i = 0; i < contents.length; i++) {
          similarityMatrix[i] = [];
          for (let j = 0; j < contents.length; j++) {
            if (i === j) {
              similarityMatrix[i][j] = 1.0;  // Self-similarity is 1
            } else if (j < i) {
              similarityMatrix[i][j] = similarityMatrix[j][i];  // Matrix is symmetric
            } else {
              // Only compute for non-empty content
              if (contents[i].length > 20 && contents[j].length > 20) {
                similarityMatrix[i][j] = jaccardSimilarity(contents[i], contents[j]);
              } else {
                similarityMatrix[i][j] = 0;
              }
            }
          }
        }

        // Cluster using a similarity threshold
        const SIMILARITY_THRESHOLD = 0.65;
        const clusters: number[][] = [];
        const visited = new Set<number>();

        for (let i = 0; i < contents.length; i++) {
          if (visited.has(i)) continue;

          const cluster: number[] = [i];
          visited.add(i);

          for (let j = 0; j < contents.length; j++) {
            if (i !== j && !visited.has(j) && similarityMatrix[i][j] >= SIMILARITY_THRESHOLD) {
              cluster.push(j);
              visited.add(j);
            }
          }

          clusters.push(cluster);
        }

        return clusters;
      }

      // If we have Jina API key, try to rerank results for better relevance
      if (JINA_API_KEY && dedupedResults.length > 0 && planningOutput.enhancedQuery) {
        pushUpdateToClient({
          step: 2,
          type: 'aggregating_results',
          payload: { message: 'Reranking results by relevance...' },
        });

        try {
          console.log(`[MastraStep: ${this.name}] Reranking ${dedupedResults.length} results using Jina Reranker`);

          const maxRetries = 2;
          const backoffMs = 500;

          // Rerank with exponential backoff retry
          const rerank = async (attempt = 0): Promise<any> => {
            try {
              const headers = {
                'Authorization': `Bearer ${JINA_API_KEY}`,
                'Content-Type': 'application/json'
              };

              // Extract documents for reranking
              const documents = dedupedResults.map(d => {
                // Use a combination of title and snippet for better context
                let content = '';
                if (d.title) content += d.title;
                if (d.snippet) {
                  if (content) content += ': ';
                  content += d.snippet;
                }
                return content || d.url;
              });

              // Call Jina Reranker API
              const response = await axios.post("https://api.jina.ai/v1/rerank", {
                model: "jina-reranker-v2-base-multilingual",
                query: planningOutput.enhancedQuery, // Use the enhanced query for better ranking
                documents: documents,
                top_n: dedupedResults.length, // Get all results back, reranked
                return_documents: true
              }, {
                headers,
                timeout: 10000 // 10-second timeout
              });

              return response.data;
            } catch (error) {
              if (attempt < maxRetries) {
                // Exponential backoff
                const delay = backoffMs * Math.pow(2, attempt);
                console.log(`[MastraStep: ${this.name}] Reranking failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return rerank(attempt + 1);
              }
              throw error;
            }
          };

          // Execute reranking with retry
          const rerankerData = await rerank();

          if (rerankerData && rerankerData.results) {
            // Update scores and create index mapping of reranked results
            const rerankedScores = new Map<number, number>();

            rerankerData.results.forEach((rerankedResult: any) => {
              const originalIndex = rerankedResult.index;
              if (originalIndex >= 0 && originalIndex < dedupedResults.length) {
                rerankedScores.set(originalIndex, rerankedResult.score);
              }
            });

            // Apply new scores
            dedupedResults.forEach((result, index) => {
              if (rerankedScores.has(index)) {
                result.score = rerankedScores.get(index);
              }
            });

            // Sort by score (descending)
            dedupedResults.sort((a, b) => {
              if (!a.score) return 1;
              if (!b.score) return -1;
              return b.score - a.score;
            });

            console.log(`[MastraStep: ${this.name}] Successfully reranked results`);
          }
        } catch (error) {
          console.error(`[MastraStep: ${this.name}] Error during Jina reranking:`, error);

          // Fall back to basic relevance sorting if reranking fails
          dedupedResults.sort((a, b) => {
            // First sort by score if available
            if (a.score !== undefined && b.score !== undefined) {
              return b.score - a.score;
            }

            // Then by presence of snippet and title
            const aHasContent = !!a.snippet && !!a.title;
            const bHasContent = !!b.snippet && !!b.title;

            if (aHasContent && !bHasContent) return -1;
            if (!aHasContent && bHasContent) return 1;

            // Finally by recency if available
            if (a.publishedDate && b.publishedDate) {
              try {
                return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
              } catch (e) {
                // If date parsing fails, don't sort by date
              }
            }

            return 0;
          });
        }
      } else {
        // Default sorting if no Jina API key or no results
        dedupedResults.sort((a, b) => {
          if (!a.score) return 1;
          if (!b.score) return -1;
          return b.score - a.score;
        });
      }

      // Identify topic clusters
      const topicClusters: Record<string, number> = {};

      try {
        // Extract potential topics from titles
        const titleWords = new Map<string, number>();

        dedupedResults.forEach(result => {
          if (result.title) {
            // Extract meaningful words (filter out stop words)
            const stopWords = new Set([
              'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
              'about', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
              'do', 'does', 'did', 'of', 'this', 'that', 'these', 'those', 'it', 'they', 'them'
            ]);

            const words = result.title.toLowerCase()
              .replace(/[^\w\s]/g, ' ')
              .split(/\s+/)
              .filter(word => word.length > 3 && !stopWords.has(word));

            words.forEach(word => {
              titleWords.set(word, (titleWords.get(word) || 0) + 1);
            });
          }
        });

        // Keep only topics that appear in multiple results (at least 2)
        Array.from(titleWords.entries())
          .filter(([_, count]) => count >= 2)
          .sort(([_, countA], [__, countB]) => countB - countA)
          .slice(0, 5) // Keep top 5 topics
          .forEach(([topic, count]) => {
            topicClusters[topic] = count;
          });
      } catch (error) {
        console.error(`[MastraStep: ${this.name}] Error identifying topic clusters:`, error);
        // Continue without topic clusters
      }

      // Calculate stats
      const sourceStats = {
        totalProviders: 0,
        exa: exaResults?.results.length || 0,
        jina: jinaResults?.results.length || 0,
        firecrawl: firecrawlResults?.results.length || 0,
        deduplicatedCount: originalCount - dedupedResults.length,
        topicClusters: Object.keys(topicClusters).length > 0 ? topicClusters : undefined
      };

      sourceStats.totalProviders =
        (sourceStats.exa > 0 ? 1 : 0) +
        (sourceStats.jina > 0 ? 1 : 0) +
        (sourceStats.firecrawl > 0 ? 1 : 0);

      console.log(`[MastraStep: ${this.name}] Aggregated ${dedupedResults.length} unique results from ${sourceStats.totalProviders} sources (removed ${sourceStats.deduplicatedCount} duplicates)`);

      // Send detailed update to client
      pushUpdateToClient({
        step: 2,
        type: 'aggregation_completed',
        payload: {
          totalResults: dedupedResults.length,
          deduplicatedCount: sourceStats.deduplicatedCount,
          providers: {
            exa: sourceStats.exa,
            jina: sourceStats.jina,
            firecrawl: sourceStats.firecrawl
          },
          topicClusters: topicClusters
        }
      });

      return {
        aggregatedResults: dedupedResults,
        sourceStats
      };
    } catch (error) {
      console.error(`[MastraStep: ${this.name}] Critical error during aggregation:`, error);

      // Send error update to client
      context.pushUpdateToClient({
        step: 2,
        type: 'aggregation_error',
        payload: {
          error: true,
          errorMessage: error instanceof Error ? error.message : "Unknown error during result aggregation"
        },
        error: true,
        errorType: error instanceof Error ? error.name : "Unknown"
      });

      // Return empty results to allow the workflow to continue
      return {
        aggregatedResults: [],
        sourceStats: {
          totalProviders: 0,
          exa: 0,
          jina: 0,
          firecrawl: 0,
          deduplicatedCount: 0
        }
      };
    }
  }
});