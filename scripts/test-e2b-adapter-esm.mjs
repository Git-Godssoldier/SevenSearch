// Test script for E2B mock adapter (ESM version)
// Run with: node scripts/test-e2b-adapter-esm.mjs

import { CodeInterpreter } from '../src/lib/utils/e2b-adapter.mjs';

async function testE2BAdapter() {
  console.log('Starting E2B adapter test (ESM version)...');
  
  try {
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
    
    // Test more complex code
    console.log('Executing complex code...');
    const result2 = await codeInterpreter.notebook.execCell(`
      // This simulates processing some data
      const data = [1, 2, 3, 4, 5];
      const processed = data.map(x => x * 2);
      const sum = processed.reduce((a, b) => a + b, 0);
      return { data, processed, sum };
    `);
    console.log('Complex code result:', result2);
    
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