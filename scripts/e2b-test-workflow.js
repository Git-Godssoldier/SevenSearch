// E2B Workflow Test Script
// This script uses E2B Code Interpreter to test a basic search workflow

// Import required libraries
require('dotenv').config({ path: '.env.local' });
const { Sandbox } = require('@e2b/code-interpreter');

// Get E2B API key from environment
const E2B_API_KEY = process.env.E2B_API_KEY;

if (!E2B_API_KEY) {
  console.error('E2B_API_KEY is required in the .env.local file');
  process.exit(1);
}

// Sample search query for testing
const SEARCH_QUERY = 'What are the latest developments in quantum computing?';

async function runTest() {
  console.log('Starting E2B workflow test...');
  console.log(`Using E2B API key: ${E2B_API_KEY.substring(0, 10)}...`);
  
  try {
    // Create a new sandbox
    console.log('Creating E2B sandbox...');
    const sandbox = await Sandbox.create();
    console.log('Sandbox created successfully!');

    // Set up a test file with workflow code
    console.log('Setting up test workflow...');
    await sandbox.writeFile({
      path: '/app/workflow-test.js',
      content: `
// Simple workflow test

// Define a basic search workflow
class SearchWorkflow {
  constructor(query) {
    this.query = query;
    this.results = [];
  }

  // Simulate search
  async search() {
    console.log(\`Searching for: \${this.query}\`);
    
    // Simulate API call
    this.results = [
      { title: 'Quantum Computing Advances 2025', url: 'https://example.com/quantum1', score: 0.95 },
      { title: 'Latest Developments in Quantum Research', url: 'https://example.com/quantum2', score: 0.88 },
      { title: 'Quantum Supremacy Achieved Again', url: 'https://example.com/quantum3', score: 0.75 }
    ];
    
    return this.results;
  }

  // Process results
  async processResults() {
    console.log('Processing search results...');
    
    // Sort by score
    this.results.sort((a, b) => b.score - a.score);
    
    return {
      topResults: this.results.slice(0, 2),
      summary: 'Recent advances in quantum computing include improvements in error correction and new hardware designs.'
    };
  }

  // Run the full workflow
  async run() {
    await this.search();
    const processed = await this.processResults();
    return processed;
  }
}

// Execute the workflow
async function testWorkflow() {
  const workflow = new SearchWorkflow('${SEARCH_QUERY}');
  const result = await workflow.run();
  console.log('\\nWorkflow Result:', JSON.stringify(result, null, 2));
  return result;
}

testWorkflow().catch(console.error);
      `
    });

    // Run the test workflow
    console.log('\nExecuting test workflow...');
    const result = await sandbox.runFile({ path: '/app/workflow-test.js' });
    
    console.log('\nTest execution complete!');
    console.log('Stdout:', result.stdout);
    if (result.stderr) console.error('Stderr:', result.stderr);

    // Clean up the sandbox
    console.log('\nCleaning up sandbox...');
    await sandbox.close();
    console.log('Sandbox closed successfully');

    return {
      success: true,
      output: result.stdout
    };
  } catch (error) {
    console.error('Error running E2B test:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test
runTest()
  .then(result => {
    if (result.success) {
      console.log('\nTest completed successfully!');
    } else {
      console.error('\nTest failed:', result.error);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });