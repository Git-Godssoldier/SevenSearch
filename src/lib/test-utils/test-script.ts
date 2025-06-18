/**
 * Mastra vNext Test Script
 * This script tests the vNext event streaming system with the E2B secure runtime
 */

import dotenv from 'dotenv';
import { E2BTestRunner, createE2BTestRunner } from './e2b-test-runner';
import { EventStreamTests, runEventStreamTests } from './event-stream-tests';
import { EventStreamWriter } from '../mastra-vnext-utils/stream-events';

// Load environment variables
dotenv.config();

// Get E2B API key from environment
const E2B_API_KEY = process.env.E2B_API_KEY || '';

if (!E2B_API_KEY) {
  console.error('E2B_API_KEY environment variable not set');
  process.exit(1);
}

/**
 * Run a basic E2B test
 */
async function runBasicE2BTest() {
  console.log('Running basic E2B test...');
  
  try {
    const runner = createE2BTestRunner(E2B_API_KEY);
    await runner.initialize();
    
    const testCode = `
      // Basic test of the E2B runtime
      const data = {
        message: "Hello from E2B secure runtime!",
        timestamp: new Date().toISOString(),
        platform: process.platform,
        nodeVersion: process.version
      };
      
      console.log(JSON.stringify(data, null, 2));
      
      return data;
    `;
    
    const result = await runner.runTest(testCode);
    
    console.log('Test result:', result);
    console.log('Execution time:', result.executionTime, 'ms');
    
    await runner.close();
    
    return result;
  } catch (error) {
    console.error('Error running basic E2B test:', error);
    throw error;
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('Starting Mastra vNext E2B test script');
  
  try {
    // Run basic E2B test
    const basicTestResult = await runBasicE2BTest();
    
    if (basicTestResult.success) {
      console.log('✅ Basic E2B test passed');
      
      // Run event stream tests
      console.log('\nRunning event stream tests...');
      const streamTestResults = await runEventStreamTests(E2B_API_KEY);
      
      console.log('\nEvent stream test results:');
      streamTestResults.forEach(result => {
        const status = result.success ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} - ${result.name}`);
        if (!result.success && result.error) {
          console.log(`   Error: ${result.error}`);
        }
      });
      
      // Count passed tests
      const passedTests = streamTestResults.filter(r => r.success).length;
      console.log(`\n${passedTests}/${streamTestResults.length} tests passed`);
      
      if (passedTests === streamTestResults.length) {
        console.log('🎉 All tests passed!');
      } else {
        console.log('⚠️ Some tests failed');
        process.exit(1);
      }
    } else {
      console.error('❌ Basic E2B test failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error running tests:', error);
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  main().catch(err => {
    console.error('Uncaught error:', err);
    process.exit(1);
  });
}

export { runBasicE2BTest, main };