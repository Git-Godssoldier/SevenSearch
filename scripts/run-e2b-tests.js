/**
 * Run E2B Workflow Tests
 * 
 * This script executes the E2B workflow tests to verify that
 * the Gargantua workflows are functioning correctly.
 */

require('dotenv').config({ path: '.env.local' });
const WorkflowTestRunner = require('../src/lib/test-utils/e2b-workflow-tests').default;

async function runTests() {
  console.log('Starting E2B workflow tests...');
  
  const testRunner = new WorkflowTestRunner();
  
  try {
    // Initialize the test environment
    console.log('Initializing E2B sandbox environment...');
    await testRunner.initialize();
    
    // Test the basic search workflow
    console.log('\nTesting basic search workflow...');
    const basicSearchResult = await testRunner.testBasicSearchWorkflow(
      'What are the latest developments in quantum computing?'
    );
    console.log('Basic search workflow test result:', JSON.stringify(basicSearchResult, null, 2));
    
    // Test the enhanced search workflow
    console.log('\nTesting enhanced search workflow...');
    const enhancedSearchResult = await testRunner.testEnhancedSearchWorkflow(
      'Explain the implications of CRISPR technology for genetic disorders',
      ['exa', 'jina']
    );
    console.log('Enhanced search workflow test result:', JSON.stringify(enhancedSearchResult, null, 2));
    
    // Test the human-in-the-loop workflow
    console.log('\nTesting human-in-the-loop workflow...');
    const humanInTheLoopResult = await testRunner.testHumanInTheLoopWorkflow(
      'Compare different approaches to mitigating climate change'
    );
    console.log('Human-in-the-loop workflow test result:', JSON.stringify(humanInTheLoopResult, null, 2));
    
    console.log('\nAll tests completed!');
  } catch (error) {
    console.error('Error running E2B tests:', error);
  } finally {
    // Clean up resources
    console.log('\nCleaning up E2B resources...');
    await testRunner.cleanup();
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});