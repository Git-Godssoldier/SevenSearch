// Direct E2B Test for Workflow
// This script uses the E2B API directly to test a workflow

require('dotenv').config({ path: '.env.local' });
const https = require('https');

const E2B_API_KEY = process.env.E2B_API_KEY;

if (!E2B_API_KEY) {
  console.error('E2B_API_KEY is required in .env.local file');
  process.exit(1);
}

// The test code to be executed in the sandbox
const testCode = `
// Simple workflow test

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
  const workflow = new SearchWorkflow('What are the latest developments in quantum computing?');
  const result = await workflow.run();
  console.log('\\nWorkflow Result:', JSON.stringify(result, null, 2));
  return result;
}

testWorkflow().catch(console.error);
`;

// Create a sandbox and run the test
function createSandbox() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      template: 'nodejs', // Use the NodeJS template
      metadata: {
        name: 'workflow-test'
      }
    });

    const options = {
      hostname: 'api.e2b.dev',
      port: 443,
      path: '/v1/sandboxes',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${E2B_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          try {
            const result = JSON.parse(responseData);
            console.log('Sandbox created successfully!');
            resolve(result);
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`));
          }
        } else {
          reject(new Error(`Failed to create sandbox: ${res.statusCode} ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Error creating sandbox: ${error.message}`));
    });

    req.write(data);
    req.end();
  });
}

// Run code in the sandbox
function runCodeInSandbox(sandboxId, code) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      code
    });

    const options = {
      hostname: 'api.e2b.dev',
      port: 443,
      path: `/v1/sandboxes/${sandboxId}/code`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${E2B_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(responseData);
            resolve(result);
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`));
          }
        } else {
          reject(new Error(`Failed to run code: ${res.statusCode} ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Error running code: ${error.message}`));
    });

    req.write(data);
    req.end();
  });
}

// Close the sandbox
function closeSandbox(sandboxId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.e2b.dev',
      port: 443,
      path: `/v1/sandboxes/${sandboxId}`,
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${E2B_API_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 204) {
          console.log('Sandbox closed successfully!');
          resolve();
        } else {
          reject(new Error(`Failed to close sandbox: ${res.statusCode} ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Error closing sandbox: ${error.message}`));
    });

    req.end();
  });
}

// Main test function
async function runTest() {
  console.log('Starting E2B workflow test...');
  let sandboxId = null;

  try {
    // Create a sandbox
    const sandbox = await createSandbox();
    sandboxId = sandbox.sandboxId;
    console.log(`Sandbox created with ID: ${sandboxId}`);

    // Run the test code
    console.log('\nRunning test workflow...');
    const result = await runCodeInSandbox(sandboxId, testCode);
    
    console.log('\nTest output:');
    if (result.stdout) console.log('Stdout:', result.stdout);
    if (result.stderr) console.error('Stderr:', result.stderr);
    
    return {
      success: true,
      output: result.stdout,
      error: result.stderr
    };
  } catch (error) {
    console.error('Error during test:', error.message);
    return {
      success: false,
      error: error.message
    };
  } finally {
    // Clean up sandbox
    if (sandboxId) {
      try {
        await closeSandbox(sandboxId);
      } catch (error) {
        console.error('Error closing sandbox:', error.message);
      }
    }
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