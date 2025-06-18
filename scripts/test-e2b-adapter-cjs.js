// Test script for E2B mock adapter (CommonJS version)
// Run with: node scripts/test-e2b-adapter-cjs.js

async function testE2BAdapter() {
  console.log('Starting E2B adapter test (CommonJS version)...');
  
  try {
    // Import the adapter module (JS version)
    const { CodeInterpreter } = require('../src/lib/utils/e2b-adapter.js');
    
    // Create a new mock CodeInterpreter instance
    console.log('Creating mock CodeInterpreter...');
    const codeInterpreter = await CodeInterpreter.create({ apiKey: 'dummy-key' });
    
    // Execute some test code
    console.log('Executing test code...');
    const result = await codeInterpreter.notebook.execCell(`
      // This is a simple test
      console.log('Hello from mock E2B!');
      return { message: 'Test completed', value: 42 };
    `);
    console.log('Execution result:', result);
    
    // Close the interpreter
    console.log('Closing interpreter...');
    await codeInterpreter.close();
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test
testE2BAdapter();