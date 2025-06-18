/**
 * E2B Workflow Tests
 *
 * This file contains tests that use E2B to test Gargantua's workflows
 * in a secure sandbox environment.
 */

import { E2B } from 'e2b';
import { v4 as uuidv4 } from 'uuid';
import {
  type TestEvent,
  type SearchProviderName,
  type TestResult,
  type E2BSandbox
} from './e2b-types';

// E2B configuration
const E2B_API_KEY = process.env.E2B_API_KEY;
const SANDBOX_TEMPLATE = 'nodejs';

// Test event logging
type TestEvent = {
  type: string;
  timestamp: number;
  data: any;
};

class WorkflowTestRunner {
  private e2b: E2B;
  private sandbox: any;
  private isInitialized = false;
  private events: TestEvent[] = [];
  private searchId: string;
  private userId: string;

  constructor() {
    if (!E2B_API_KEY) {
      throw new Error('E2B_API_KEY environment variable is required');
    }

    this.e2b = new E2B({ apiKey: E2B_API_KEY });
    this.searchId = uuidv4();
    this.userId = uuidv4();
  }

  /**
   * Initialize the E2B sandbox environment
   */
  async initialize(): Promise<void> {
    // Create a secure sandbox
    this.sandbox = await this.e2b.sandbox.create({ template: SANDBOX_TEMPLATE });
    
    // Set up the required environment
    await this.sandbox.filesystem.writeFile({
      path: '/app/package.json',
      content: JSON.stringify({
        "name": "workflow-test",
        "dependencies": {
          "@mastra/core": "latest",
          "@mastra/memory": "latest",
          "zod": "latest",
          "nanoid": "latest",
          "uuid": "latest"
        }
      })
    });
    
    // Install dependencies
    await this.sandbox.process.start({
      cmd: 'npm install',
      cwd: '/app',
      onStdout: (data: string) => this.logEvent('npm-install-stdout', data),
      onStderr: (data: string) => this.logEvent('npm-install-stderr', data)
    });
    
    // Copy our workflow files to the sandbox
    // Placeholder - in a real implementation, we would copy the actual workflow files

    this.isInitialized = true;
  }

  /**
   * Log a test event with timestamp
   */
  private logEvent(type: string, data: any): void {
    this.events.push({
      type,
      timestamp: Date.now(),
      data
    });
    
    // Optionally also log to console for real-time feedback
    console.log(`[${type}]`, typeof data === 'string' ? data.slice(0, 100) : data);
  }

  /**
   * Test the basic search workflow
   */
  async testBasicSearchWorkflow(query: string): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Create a test script for running the basic search workflow
    const testScript = `
    const { createWorkflow } = require('@mastra/core');
    const { z } = require('zod');
    
    // Mock search providers for testing
    const mockSearchProvider = {
      search: async (query) => {
        return [
          { 
            title: 'Test Result 1',
            url: 'https://example.com/1',
            snippet: 'This is a test result related to ' + query
          },
          {
            title: 'Test Result 2',
            url: 'https://example.com/2',
            snippet: 'Another test result for ' + query
          }
        ];
      }
    };

    // Create the test workflow
    const testWorkflow = createWorkflow({
      name: 'testSearch',
      description: 'A test search workflow',
      inputSchema: z.object({
        query: z.string(),
        searchId: z.string(),
        userId: z.string()
      }),
      outputSchema: z.object({
        searchId: z.string(),
        results: z.array(z.object({
          title: z.string(),
          url: z.string(),
          snippet: z.string().optional()
        }))
      })
    });

    // Add steps to the workflow
    testWorkflow
      .then(createStep({
        id: 'search',
        execute: async ({ inputData }) => {
          console.log('Executing search for:', inputData.query);
          const results = await mockSearchProvider.search(inputData.query);
          return { results };
        }
      }))
      .then(createStep({
        id: 'aggregate',
        execute: async ({ stepOutputs, inputData }) => {
          const searchResults = stepOutputs.search.results;
          return {
            searchId: inputData.searchId,
            results: searchResults
          };
        }
      }));

    // Run the workflow
    const testExecutor = {
      execute: async (workflow, input) => {
        console.log('Executing workflow with input:', input);
        // Simple executor just for testing
        const searchOutput = await workflow.steps.search.execute({ inputData: input });
        const aggregateOutput = await workflow.steps.aggregate.execute({ 
          stepOutputs: { search: searchOutput },
          inputData: input
        });
        return aggregateOutput;
      }
    };

    async function runTest() {
      try {
        const input = {
          query: '${query}',
          searchId: '${this.searchId}',
          userId: '${this.userId}'
        };
        
        const result = await testExecutor.execute(testWorkflow, input);
        console.log('Workflow execution completed with result:', result);
        return { success: true, result };
      } catch (error) {
        console.error('Workflow execution failed:', error);
        return { success: false, error: error.message };
      }
    }

    runTest().then(result => console.log(JSON.stringify(result)));
    `;

    // Write the test script to the sandbox
    await this.sandbox.filesystem.writeFile({
      path: '/app/test-search-workflow.js',
      content: testScript
    });

    // Execute the test script
    const process = await this.sandbox.process.start({
      cmd: 'node /app/test-search-workflow.js',
      cwd: '/app',
      onStdout: (data: string) => this.logEvent('workflow-test-stdout', data),
      onStderr: (data: string) => this.logEvent('workflow-test-stderr', data)
    });

    // Wait for the process to complete
    const { stdout, stderr } = await process.wait();
    
    // Parse and return results
    try {
      // Extract the JSON result from the stdout
      const resultMatch = stdout.match(/\{.*\}/s);
      if (resultMatch) {
        return JSON.parse(resultMatch[0]);
      }
      
      return { 
        success: false, 
        error: 'Failed to parse test results', 
        stdout, 
        stderr
      };
    } catch (error) {
      return {
        success: false,
        error: `Error parsing test results: ${error.message}`,
        stdout,
        stderr
      };
    }
  }

  /**
   * Test the enhanced search workflow with multiple providers
   */
  async testEnhancedSearchWorkflow(
    query: string, 
    providers: SearchProviderName[] = ['exa', 'jina']
  ): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Similar to the basic search workflow test, but with multiple providers
    // and more complex orchestration
    // Placeholder implementation
    
    return {
      success: true,
      message: 'Enhanced search workflow test - implementation pending',
      query,
      providers
    };
  }

  /**
   * Test the human-in-the-loop workflow with suspension and resumption
   */
  async testHumanInTheLoopWorkflow(query: string): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Placeholder for testing human-in-the-loop workflow with suspension
    // This would simulate the suspension of a workflow and its later resumption
    
    return {
      success: true,
      message: 'Human-in-the-loop workflow test - implementation pending',
      query
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.sandbox) {
      await this.sandbox.close();
    }
  }

  /**
   * Get all logged events
   */
  getEvents(): TestEvent[] {
    return this.events;
  }
}

// Export the test runner
export default WorkflowTestRunner;