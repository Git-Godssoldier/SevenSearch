/**
 * Content Processing Utilities for Mastra vNext
 * 
 * This file contains helper functions for processing text content,
 * extracting structured information, and cleaning HTML.
 */

/**
 * Extract "think" sections from AI-generated text
 * These sections are typically enclosed in <think> tags and represent 
 * internal reasoning that should not be shown to end users
 * 
 * @param text The text to process
 * @returns An object with sections and cleaned text
 */
export function extractThinkSections(text: string): { sections: string[], cleanedText: string } {
  // Define the regex pattern for <think></think> tags
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
  const sections: string[] = [];
  
  // Extract all think sections
  let match;
  while ((match = thinkRegex.exec(text)) !== null) {
    if (match[1] && match[1].trim()) {
      sections.push(match[1].trim());
    }
  }
  
  // Clean the text by removing think sections
  const cleanedText = text.replace(thinkRegex, '').trim();
  
  return { sections, cleanedText };
}

/**
 * Extract citations from text
 * 
 * @param text The text to process for citations
 * @returns An array of citation objects
 */
export function extractCitations(text: string): Array<{ id: string, text: string, url?: string }> {
  // Citation patterns:
  // [1] or [1]: or {{1}} or ^1
  const citations: Array<{ id: string, text: string, url?: string }> = [];
  
  // Look for [1] style citations with matching [1]: details
  const basicCitationRegex = /\[(\d+)\]/g;
  const detailedCitationRegex = /\[(\d+)\]:\s*(.*?)(?=\n\[\d+\]:|$)/gs;
  
  // Extract all detailed citation references
  const citationDetails = new Map<string, string>();
  let detailedMatch;
  while ((detailedMatch = detailedCitationRegex.exec(text)) !== null) {
    if (detailedMatch[1] && detailedMatch[2]) {
      citationDetails.set(detailedMatch[1], detailedMatch[2].trim());
    }
  }
  
  // Extract all basic citation markers
  let basicMatch;
  while ((basicMatch = basicCitationRegex.exec(text)) !== null) {
    const id = basicMatch[1];
    if (citationDetails.has(id)) {
      citations.push({
        id: id,
        text: citationDetails.get(id) || '',
        url: extractUrlFromCitation(citationDetails.get(id) || '')
      });
    } else {
      citations.push({
        id: id,
        text: `Citation ${id}`,
      });
    }
  }
  
  return citations;
}

/**
 * Extract URL from a citation text if present
 * 
 * @param citationText The citation text that might contain a URL
 * @returns The URL if found, undefined otherwise
 */
function extractUrlFromCitation(citationText: string): string | undefined {
  const urlRegex = /https?:\/\/[^\s)]+/;
  const match = citationText.match(urlRegex);
  return match ? match[0] : undefined;
}

/**
 * Clean HTML content by removing scripts, styles, and unnecessary elements
 * 
 * @param html HTML content to clean
 * @returns Cleaned HTML content
 */
export function cleanHTML(html: string): string {
  // Simple HTML cleaning for demo purposes
  // In production, use a proper HTML sanitizer like DOMPurify
  
  // Remove scripts and styles
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  
  // Remove data attributes
  cleaned = cleaned.replace(/ data-[\w-]+(=['"][^'"]*['"])?/g, '');
  
  return cleaned;
}

/**
 * Remove common advertisements, banners, and popups from HTML content
 * 
 * @param html HTML content to process
 * @returns HTML with ads and banners removed
 */
export function removeBannersAndAds(html: string): string {
  // Simple banner and ad removal for demo purposes
  
  // Common ad and banner related classes and IDs
  const adSelectors = [
    'ads', 'banner', 'advertisement', 'ad-', 'popup', 'modal',
    'newsletter', 'subscribe', 'cookie-banner', 'gdpr'
  ];
  
  let cleaned = html;
  
  // Remove divs with ad-related classes or IDs
  adSelectors.forEach(selector => {
    // Remove elements with class containing selector
    const classRegex = new RegExp(`<div[^>]*class=['"][^'"]*${selector}[^'"]*['"][^>]*>.*?<\/div>`, 'gis');
    cleaned = cleaned.replace(classRegex, '');
    
    // Remove elements with ID containing selector
    const idRegex = new RegExp(`<div[^>]*id=['"][^'"]*${selector}[^'"]*['"][^>]*>.*?<\/div>`, 'gis');
    cleaned = cleaned.replace(idRegex, '');
  });
  
  return cleaned;
}