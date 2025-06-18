/**
 * Content processing utilities for Mastra vNext workflow steps
 */

export interface ContentProcessingOptions {
  maxTokens?: number;
  summarize?: boolean;
  deduplicate?: boolean;
  filterByRelevance?: boolean;
  relevanceThreshold?: number;
}

export interface ContentBlock {
  id: string;
  content: string;
  metadata?: {
    source?: string;
    url?: string;
    timestamp?: string;
    relevanceScore?: number;
    [key: string]: any;
  };
}

export interface ProcessedContent {
  blocks: ContentBlock[];
  summary?: string;
  metadata: {
    totalBlocks: number;
    totalChars: number;
    processedAt: string;
    [key: string]: any;
  };
}

/**
 * Extract sections marked with "think" tags from content
 */
export function extractThinkSections(content: string): string[] {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
  const matches = Array.from(content.matchAll(thinkRegex));
  return matches.map(match => match[1].trim());
}

/**
 * Extract citations from content
 */
export function extractCitations(content: string): { text: string, source: string }[] {
  // Simple citation format: [citation: text (source)]
  const citationRegex = /\[citation:\s*(.*?)\s*\((.*?)\)\]/g;
  const matches = Array.from(content.matchAll(citationRegex));
  
  return matches.map(match => ({
    text: match[1].trim(),
    source: match[2].trim()
  }));
}

/**
 * Process content blocks according to provided options
 * This is used by various workflow steps that need content processing
 */
export async function processContent(
  blocks: ContentBlock[],
  options: ContentProcessingOptions = {}
): Promise<ProcessedContent> {
  let processedBlocks = [...blocks];
  
  if (options.deduplicate) {
    processedBlocks = deduplicateContent(processedBlocks);
  }
  
  if (options.filterByRelevance && options.relevanceThreshold) {
    processedBlocks = filterByRelevance(processedBlocks, options.relevanceThreshold);
  }
  
  // Calculate metadata
  const totalChars = processedBlocks.reduce((sum, block) => sum + block.content.length, 0);
  
  return {
    blocks: processedBlocks,
    summary: options.summarize ? await generateSummary(processedBlocks) : undefined,
    metadata: {
      totalBlocks: processedBlocks.length,
      totalChars,
      processedAt: new Date().toISOString()
    }
  };
}

/**
 * Remove duplicate or highly similar content blocks
 */
function deduplicateContent(blocks: ContentBlock[]): ContentBlock[] {
  const uniqueIds = new Set<string>();
  return blocks.filter(block => {
    if (uniqueIds.has(block.id)) {
      return false;
    }
    uniqueIds.add(block.id);
    return true;
  });
}

/**
 * Filter content blocks by relevance score
 */
function filterByRelevance(blocks: ContentBlock[], threshold: number): ContentBlock[] {
  return blocks.filter(block => {
    const score = block.metadata?.relevanceScore ?? 0;
    return score >= threshold;
  });
}

/**
 * Generate a summary from content blocks
 */
async function generateSummary(blocks: ContentBlock[]): Promise<string> {
  // This would typically call an AI service to generate a summary
  // For now, we return a placeholder
  if (blocks.length === 0) {
    return "No content to summarize";
  }
  
  return `Summary of ${blocks.length} content blocks`;
}