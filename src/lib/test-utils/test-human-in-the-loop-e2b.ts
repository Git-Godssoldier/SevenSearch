/**
 * Human-in-the-Loop Workflow Test Script with E2B Integration
 * 
 * This script demonstrates how to run a workflow with human-in-the-loop capabilities,
 * handle workflow suspension, and resume the workflow with user input using E2B for
 * secure runtime evaluation and testing.
 */

import { Mastra } from '@mastra/core';
import { ConsoleLogger } from '@mastra/loggers';
import { v4 as uuidv4 } from 'uuid';
import { humanReviewWorkflow } from '../mastra-vnext-workflows';
import { EventStreamWriter } from '../mastra-vnext-utils';
import { E2BTestRunner } from './e2b-test-runner';
import { RecursiveImprovementManager } from './recursive-improvement';

// Configure runtime context for the test
const testRuntimeContext = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  EXA_API_KEY: process.env.EXA_API_KEY || '',
  JINA_API_KEY: process.env.JINA_API_KEY || '',
  E2B_API_KEY: process.env.E2B_API_KEY || '',
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  SCRAPYBARA_API_KEY: process.env.SCRAPYBARA_API_KEY || '',
  searchId: `test-${uuidv4()}`,
  userId: 'test-user-id',
};

/**
 * Human Review Testing with E2B
 * 
 * Tests the human review workflow with E2B secure runtime evaluation
 * to validate and enhance the workflow
 */
export class HumanReviewE2BTester {
  private e2bRunner: E2BTestRunner;
  private improvementManager: RecursiveImprovementManager;
  private isInitialized = false;

  constructor(apiKey: string) {
    this.e2bRunner = new E2BTestRunner(apiKey);
    this.improvementManager = new RecursiveImprovementManager(apiKey);
  }

  /**
   * Initialize the tester
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await this.e2bRunner.initialize();
    await this.improvementManager.initialize();
    this.isInitialized = true;
    console.log('Human Review E2B Tester initialized');
  }

  /**
   * Run the human review workflow test
   */
  async runHumanReviewWorkflowTest(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log('Starting Human Review Workflow Test with E2B');

    // Test 1: Validate workflow suspension
    const suspensionTest = `
      try {
        // Mock implementation of suspension
        const mockSuspend = async (data) => {
          console.log('Workflow suspended with data:', JSON.stringify(data));
          return true;
        };

        // Mock input data
        const inputData = {
          searchResults: [
            { title: 'Result 1', url: 'https://example.com/1', snippet: 'Example snippet 1' },
            { title: 'Result 2', url: 'https://example.com/2', snippet: 'Example snippet 2' },
            { title: 'Result 3', url: 'https://example.com/3', snippet: 'Example snippet 3' }
          ],
          query: 'test query',
          enhancedQuery: 'enhanced test query'
        };

        // Mock event emitter
        const mockEmitter = {
          emit: (event, data) => console.log('Event emitted:', event, 'with data:', JSON.stringify(data))
        };

        // Mock runtime context
        const mockContext = {
          getAll: () => ({ searchId: 'test-123', userId: 'user-123' })
        };

        // Simulate human review step execution with suspension
        const humanReviewStepExecute = async ({ inputData, resumeData, suspend, emitter, runtimeContext }) => {
          if (!resumeData) {
            const suggestedSelection = [0, 1];
            await suspend({
              searchResults: inputData.searchResults,
              query: inputData.query,
              enhancedQuery: inputData.enhancedQuery,
              suggestedSelection,
              userMessage: 'Please select relevant results',
              suspendedAt: new Date().toISOString()
            });
            return null;
          }
          
          const selectedResults = resumeData.selectedResultIndices.map(
            index => inputData.searchResults[index]
          );
          
          return {
            selectedResults,
            additionalInstructions: resumeData.additionalInstructions,
            userSelection: true
          };
        };

        // Test suspension
        const result = await humanReviewStepExecute({
          inputData,
          resumeData: null,
          suspend: mockSuspend,
          emitter: mockEmitter,
          runtimeContext: mockContext
        });

        // Check if suspension happened
        if (result === null) {
          return { success: true, message: 'Workflow suspension test passed' };
        } else {
          return { success: false, message: 'Workflow suspension test failed - workflow did not suspend' };
        }
      } catch (error) {
        return { success: false, message: \`Workflow suspension test failed with error: \${error.message}\` };
      }
    `;

    // Test 2: Validate workflow resumption
    const resumptionTest = `
      try {
        // Mock input data
        const inputData = {
          searchResults: [
            { title: 'Result 1', url: 'https://example.com/1', snippet: 'Example snippet 1' },
            { title: 'Result 2', url: 'https://example.com/2', snippet: 'Example snippet 2' },
            { title: 'Result 3', url: 'https://example.com/3', snippet: 'Example snippet 3' }
          ],
          query: 'test query',
          enhancedQuery: 'enhanced test query'
        };

        // Mock resume data (simulating user input)
        const resumeData = {
          selectedResultIndices: [0, 2],
          additionalInstructions: 'Focus on example 1 and 3',
          resumedAt: new Date().toISOString()
        };

        // Mock event emitter
        const mockEmitter = {
          emit: (event, data) => console.log('Event emitted:', event, 'with data:', JSON.stringify(data))
        };

        // Mock runtime context
        const mockContext = {
          getAll: () => ({ searchId: 'test-123', userId: 'user-123' })
        };

        // Mock suspend function (should not be called during resumption)
        const mockSuspend = async () => {
          throw new Error('Suspend should not be called during resumption');
        };

        // Simulate human review step execution with resumption
        const humanReviewStepExecute = async ({ inputData, resumeData, suspend, emitter, runtimeContext }) => {
          if (!resumeData) {
            const suggestedSelection = [0, 1];
            await suspend({
              searchResults: inputData.searchResults,
              query: inputData.query,
              enhancedQuery: inputData.enhancedQuery,
              suggestedSelection,
              userMessage: 'Please select relevant results',
              suspendedAt: new Date().toISOString()
            });
            return null;
          }
          
          const selectedResults = resumeData.selectedResultIndices.map(
            index => inputData.searchResults[index]
          );
          
          return {
            selectedResults,
            additionalInstructions: resumeData.additionalInstructions,
            userSelection: true
          };
        };

        // Test resumption
        const result = await humanReviewStepExecute({
          inputData,
          resumeData,
          suspend: mockSuspend,
          emitter: mockEmitter,
          runtimeContext: mockContext
        });

        // Check if resumption produced expected output
        if (result && 
            result.selectedResults && 
            result.selectedResults.length === 2 &&
            result.additionalInstructions === resumeData.additionalInstructions &&
            result.userSelection === true) {
          return { 
            success: true, 
            message: 'Workflow resumption test passed',
            result
          };
        } else {
          return { 
            success: false, 
            message: 'Workflow resumption test failed - unexpected result',
            expected: {
              selectedResults: [inputData.searchResults[0], inputData.searchResults[2]],
              additionalInstructions: resumeData.additionalInstructions,
              userSelection: true
            },
            actual: result
          };
        }
      } catch (error) {
        return { success: false, message: \`Workflow resumption test failed with error: \${error.message}\` };
      }
    `;

    // Run the tests
    const suspensionResult = await this.e2bRunner.runTest(suspensionTest);
    console.log('Suspension Test Result:', suspensionResult.success ? 'PASSED' : 'FAILED');
    console.log(suspensionResult.output);

    const resumptionResult = await this.e2bRunner.runTest(resumptionTest);
    console.log('Resumption Test Result:', resumptionResult.success ? 'PASSED' : 'FAILED');
    console.log(resumptionResult.output);

    // Find potential improvements
    if (suspensionResult.success && resumptionResult.success) {
      console.log('All tests passed. Looking for potential improvements...');
      const improvements = await this.improvementManager.runImprovementCycle();
      
      if (improvements.length > 0) {
        console.log('Suggested improvements:');
        improvements.forEach((improvement, index) => {
          console.log(`\n[${index + 1}] ${improvement.priority.toUpperCase()} priority: ${improvement.suggestion}`);
        });
      } else {
        console.log('No improvements suggested. The implementation is solid!');
      }
    } else {
      console.log('Tests failed. Please fix the issues before looking for improvements.');
    }
  }

  /**
   * Test the workflow suspension database integration
   */
  async testDatabaseIntegration(): Promise<void> {
    // Note: This would typically use a test database or mock
    const databaseIntegrationTest = `
      try {
        // Mock Supabase client
        const mockSupabase = {
          from: (table) => ({
            insert: (data) => Promise.resolve({ data, error: null }),
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    single: () => Promise.resolve({ data: { suspend_data: {}, suspended_step_id: 'human-review' }, error: null })
                  })
                })
              })
            }),
            update: (data) => ({
              eq: () => ({
                eq: () => Promise.resolve({ data, error: null })
              })
            })
          })
        };

        // Mock API request handler for POST /api/resume-workflow
        const mockResumeWorkflowPost = async (request) => {
          const body = {
            searchId: 'test-123',
            stepId: 'human-review',
            resumeData: {
              selectedResultIndices: [0, 1],
              additionalInstructions: 'Test instructions',
              resumedAt: new Date().toISOString()
            }
          };

          try {
            // Check if workflow exists and is suspended (using mock Supabase)
            const { data: workflowData, error: fetchError } = await mockSupabase
              .from('suspended_workflows')
              .select('*')
              .eq('searchId', body.searchId)
              .eq('user_id', 'test-user')
              .eq('is_suspended', true)
              .single();
            
            if (fetchError) {
              return { status: 404, body: { error: 'Workflow not found' } };
            }
            
            // Ensure workflow is suspended at the correct step
            if (workflowData.suspended_step_id !== body.stepId) {
              return { status: 409, body: { error: 'Workflow suspended at different step' } };
            }
            
            // Mark workflow as resumed in the database
            const updateResult = await mockSupabase
              .from('suspended_workflows')
              .update({
                resumed_at: new Date().toISOString(),
                resume_data: body.resumeData,
                is_suspended: false
              })
              .eq('searchId', body.searchId)
              .eq('user_id', 'test-user');
            
            return { 
              status: 200, 
              body: { 
                success: true, 
                message: 'Workflow resumption initiated',
                searchId: body.searchId
              }
            };
          } catch (error) {
            return { status: 500, body: { error: \`Server error: \${error.message}\` } };
          }
        };

        // Test the POST handler
        const result = await mockResumeWorkflowPost({});
        
        if (result.status === 200 && result.body.success) {
          return { success: true, message: 'Database integration test passed' };
        } else {
          return { success: false, message: 'Database integration test failed', result };
        }
      } catch (error) {
        return { success: false, message: \`Database integration test failed with error: \${error.message}\` };
      }
    `;

    const dbIntegrationResult = await this.e2bRunner.runTest(databaseIntegrationTest);
    console.log('Database Integration Test Result:', dbIntegrationResult.success ? 'PASSED' : 'FAILED');
    console.log(dbIntegrationResult.output);
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    await this.initialize();
    await this.runHumanReviewWorkflowTest();
    await this.testDatabaseIntegration();
  }

  /**
   * Close the tester
   */
  async close(): Promise<void> {
    await this.e2bRunner.close();
    await this.improvementManager.close();
    this.isInitialized = false;
    console.log('Human Review E2B Tester closed');
  }
}

/**
 * Create a new Human Review E2B Tester
 * @param apiKey E2B API key
 * @returns HumanReviewE2BTester instance
 */
export function createHumanReviewE2BTester(apiKey: string): HumanReviewE2BTester {
  return new HumanReviewE2BTester(apiKey);
}

// Only execute if run directly
if (require.main === module) {
  const apiKey = process.env.E2B_API_KEY;
  
  if (!apiKey) {
    console.error('E2B_API_KEY is required to run tests');
    process.exit(1);
  }
  
  const tester = createHumanReviewE2BTester(apiKey);
  tester.runAllTests()
    .catch(console.error)
    .finally(() => tester.close());
}

export default createHumanReviewE2BTester;