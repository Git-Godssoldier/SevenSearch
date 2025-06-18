// Test script for E2B mock adapter
import { CodeInterpreter } from '../src/lib/utils/e2b-adapter.js';

async function testE2BAdapter() {
  console.log('Starting E2B adapter test...');
  
  try {
    // Create a new mock CodeInterpreter instance
    console.log('Creating mock CodeInterpreter...');
    const codeInterpreter = await CodeInterpreter.create({ apiKey: 'dummy-key' });
    
    // Execute some test code
    console.log('Executing simple arithmetic code...');
    const result1 = await codeInterpreter.notebook.execCell(`
      // This is a simple arithmetic operation
      const a = 10;
      const b = 32;
      const sum = a + b;
      console.log('The sum is:', sum);
      return { sum };
    `);
    console.log('Execution result 1:', result1);
    
    // Execute a more complex code block
    console.log('Executing data processing code...');
    const result2 = await codeInterpreter.notebook.execCell(`
      // This simulates processing some data
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const processedData = data.map(x => x * 2).filter(x => x > 10);
      const stats = {
        sum: processedData.reduce((a, b) => a + b, 0),
        count: processedData.length,
        average: processedData.reduce((a, b) => a + b, 0) / processedData.length
      };
      return stats;
    `);
    console.log('Execution result 2:', result2);
    
    // Test error handling
    console.log('Testing error handling...');
    try {
      const result3 = await codeInterpreter.notebook.execCell(`
        // This should cause an error
        throw new Error("Intentional test error");
        return "This should not be reached";
      `);
      console.log('Execution result 3 (should not reach here):', result3);
    } catch (error) {
      console.log('Caught expected error:', error.message);
    }
    
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