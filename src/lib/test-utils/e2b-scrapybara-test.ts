/**
 * E2B-Scrapybara Integration Test
 * 
 * This file tests the integration between E2B Code Interpreter and Scrapybara
 * for content extraction and processing.
 */

import { E2BTestRunner, createE2BTestRunner } from './e2b-test-runner';
import { ScrabybaraProcessor } from '../mastra-vnext-utils/e2b-scrapybara-integration';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get API keys from environment
const E2B_API_KEY = process.env.E2B_API_KEY || '';
const SCRAPYBARA_API_KEY = process.env.SCRAPYBARA_API_KEY || '';

/**
 * Test ScrabybaraProcessor with a mock Scrapybara client
 */
async function testScrabybaraProcessor() {
  // Create a mock Scrapybara client that returns fixed content
  const mockScrabybaraClient = {
    act: async (url: string, instructions: string) => {
      return `
        # Sample Web Page
        
        This is a sample web page content for testing the ScrabybaraProcessor.
        
        ## Section 1
        
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor,
        nisl eget ultricies ultrices, nisl nisl ultricies nisl, nec ultricies
        nisl nisl eget nisl.
        
        ## Section 2
        
        - Item 1: This is the first item with a date: 2023-01-15
        - Item 2: This is the second item with an email: test@example.com
        - Item 3: This is the third item with a URL: https://example.com
        
        ## Section 3
        
        This is the final section of the sample web page content.
      `;
    }
  };
  
  // Create a ScrabybaraProcessor instance
  const processor = new ScrabybaraProcessor(
    E2B_API_KEY,
    mockScrabybaraClient as any
  );
  
  try {
    // Test content extraction
    console.log('Testing content extraction...');
    const extractedContent = await processor.extractContent(
      'https://example.com',
      'Extract the main content'
    );
    
    console.log(`Extracted ${extractedContent.content.length} content blocks from the URL`);
    
    // Test content cleaning
    console.log('\nTesting content cleaning...');
    const cleanedContent = await processor.processContent(
      extractedContent,
      'clean'
    );
    
    console.log(`Cleaned content has ${
      Array.isArray(cleanedContent.processedContent) 
        ? cleanedContent.processedContent.length 
        : cleanedContent.processedContent.length
    } characters`);
    
    // Test entity extraction
    console.log('\nTesting entity extraction...');
    const entitiesContent = await processor.processContent(
      extractedContent,
      'extract-entities'
    );
    
    console.log(`Extracted ${
      entitiesContent.metadata?.entities?.length || 0
    } entities from the content`);
    
    // Test content summarization
    console.log('\nTesting content summarization...');
    const summarizedContent = await processor.processContent(
      extractedContent,
      'summarize'
    );
    
    console.log(`Generated summary with ${
      typeof summarizedContent.processedContent === 'string'
        ? summarizedContent.processedContent.length
        : JSON.stringify(summarizedContent.processedContent).length
    } characters`);
    
    // Test content analysis
    console.log('\nTesting content analysis...');
    const analyzedContent = await processor.processContent(
      extractedContent,
      'analyze'
    );
    
    console.log('Analysis results:');
    console.log(`- Paragraphs: ${analyzedContent.metadata?.structure?.paragraphCount || 0}`);
    console.log(`- Sentences: ${analyzedContent.metadata?.structure?.sentenceCount || 0}`);
    console.log(`- Words: ${analyzedContent.metadata?.structure?.wordCount || 0}`);
    console.log(`- Readability score: ${analyzedContent.metadata?.quality?.readability || 0}`);
    
    // Test custom processing with custom code
    console.log('\nTesting custom processing...');
    const customContent = await processor.processContent(
      extractedContent,
      'custom',
      `
        // Custom processing that counts occurrences of words
        function countWordFrequency(text) {
          const words = text.toLowerCase().match(/\\b\\w+\\b/g) || [];
          const wordCounts = {};
          
          words.forEach(word => {
            wordCounts[word] = (wordCounts[word] || 0) + 1;
          });
          
          return {
            processedContent: text,
            metadata: {
              wordFrequency: wordCounts,
              uniqueWords: Object.keys(wordCounts).length,
              totalWords: words.length
            }
          };
        }
        
        countWordFrequency(content);
      `
    );
    
    console.log(`Custom processing found ${
      customContent.metadata?.uniqueWords || 0
    } unique words out of ${
      customContent.metadata?.totalWords || 0
    } total words`);
    
    return {
      success: true,
      results: {
        extraction: extractedContent,
        cleaning: cleanedContent,
        entities: entitiesContent,
        summary: summarizedContent,
        analysis: analyzedContent,
        custom: customContent
      }
    };
  } catch (error) {
    console.error('Error testing ScrabybaraProcessor:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    // Close the processor to release resources
    await processor.close();
  }
}

/**
 * Run the E2B-Scrapybara integration test
 */
async function runE2BScrabybaraTest() {
  console.log('Running E2B-Scrapybara integration test...');
  
  if (!E2B_API_KEY) {
    console.error('E2B_API_KEY environment variable not set');
    process.exit(1);
  }
  
  try {
    // Test the ScrabybaraProcessor
    const processorResult = await testScrabybaraProcessor();
    
    if (processorResult.success) {
      console.log('\n✅ ScrabybaraProcessor test passed');
    } else {
      console.error('\n❌ ScrabybaraProcessor test failed:', processorResult.error);
    }
    
    // Test direct E2B code execution with Scrapybara-like tasks
    const e2bRunner = createE2BTestRunner(E2B_API_KEY);
    await e2bRunner.initialize();
    
    console.log('\nTesting direct E2B code execution with Scrapybara-like tasks...');
    
    const testCode = `
      // Simulated HTML content from Scrapybara
      const htmlContent = \`
        <div class="article">
          <h1>Test Article</h1>
          <div class="content">
            <p>This is a test paragraph with <a href="https://example.com">a link</a>.</p>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
              <li>Item 3</li>
            </ul>
            <p>Another paragraph with some <strong>bold text</strong>.</p>
          </div>
        </div>
      \`;
      
      // Parse HTML content
      function parseHTML(html) {
        const results = {
          title: html.match(/<h1[^>]*>(.*?)<\\/h1>/i)?.[1] || 'No title',
          paragraphs: [],
          links: [],
          items: []
        };
        
        // Extract paragraphs
        const paragraphMatches = html.matchAll(/<p[^>]*>(.*?)<\\/p>/gi);
        for (const match of paragraphMatches) {
          results.paragraphs.push(match[1].replace(/<[^>]*>/g, ''));
        }
        
        // Extract links
        const linkMatches = html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\\/a>/gi);
        for (const match of linkMatches) {
          results.links.push({ url: match[1], text: match[2].replace(/<[^>]*>/g, '') });
        }
        
        // Extract list items
        const itemMatches = html.matchAll(/<li[^>]*>(.*?)<\\/li>/gi);
        for (const match of itemMatches) {
          results.items.push(match[1].replace(/<[^>]*>/g, ''));
        }
        
        return results;
      }
      
      // Process the HTML content
      const parsed = parseHTML(htmlContent);
      
      // Return the parsed results
      parsed;
    `;
    
    const result = await e2bRunner.runTest(testCode);
    
    if (result.success) {
      console.log('\n✅ E2B code execution test passed');
      console.log('Execution result:', result.output);
    } else {
      console.error('\n❌ E2B code execution test failed:', result.error);
    }
    
    await e2bRunner.close();
    
    return {
      success: processorResult.success && result.success,
      processorResult,
      e2bResult: result
    };
  } catch (error) {
    console.error('Error running E2B-Scrapybara integration test:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runE2BScrabybaraTest().catch(err => {
    console.error('Uncaught error:', err);
    process.exit(1);
  });
}

export { testScrabybaraProcessor, runE2BScrabybaraTest };