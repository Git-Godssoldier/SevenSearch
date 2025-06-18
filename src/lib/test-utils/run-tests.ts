/**
 * Test Runner Script
 * Executes all Mastra vNext tests with E2B secure runtime environment
 */

import { runEventStreamTests } from './event-stream-tests';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const E2B_API_KEY = process.env.E2B_API_KEY || '';

if (!E2B_API_KEY) {
  console.error('E2B_API_KEY environment variable is not set');
  process.exit(1);
}

async function runAllTests() {
  console.log('🧪 Running Mastra vNext tests in E2B secure environment...');
  
  try {
    // Run event stream tests
    console.log('\n📋 Running Event Stream Tests...');
    const eventStreamResults = await runEventStreamTests(E2B_API_KEY);
    
    console.log('\n✅ Event Stream Test Results:');
    eventStreamResults.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} - ${result.name}`);
      if (!result.success && result.error) {
        console.log(`   Error: ${result.error}`);
      }
      console.log(`   Execution time: ${result.executionTime}ms`);
      if (result.output) {
        console.log(`   Output: ${result.output}`);
      }
      console.log('');
    });
    
    // Add more test suites here as they are implemented
    
    // Display summary
    const totalTests = eventStreamResults.length;
    const passedTests = eventStreamResults.filter(r => r.success).length;
    
    console.log('\n📊 Test Summary:');
    console.log(`Total tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);
    
  } catch (error) {
    console.error('❌ Error running tests:', error);
    process.exit(1);
  }
}

// Run all tests
runAllTests().catch(err => {
  console.error('❌ Uncaught error:', err);
  process.exit(1);
});

// Export for programmatic usage
export { runAllTests };