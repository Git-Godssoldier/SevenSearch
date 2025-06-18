/**
 * Test helpers for validating Mastra vNext workflow implementations
 */
import { E2BTestRunner } from './e2b-test-runner';

interface StepTestConfig {
  name: string;
  inputData: any;
  resumeData?: any;
  expected: {
    output?: any;
    suspended?: boolean;
    error?: boolean;
  };
}

interface WorkflowTestConfig {
  name: string;
  inputData: any;
  resumeData?: Record<string, any>;
  expected: {
    output?: any;
    suspendedSteps?: string[];
    error?: boolean;
  };
}

/**
 * Test a Mastra vNext step implementation
 */
export async function testStep(
  stepImplementation: string,
  tests: StepTestConfig[],
  apiKey: string = process.env.E2B_API_KEY || ''
): Promise<boolean> {
  const runner = new E2BTestRunner({ apiKey, debug: false });
  
  try {
    const testCases = tests.map((test, index) => {
      const testFunction = `
        // Test case ${index + 1}: ${test.name}
        async function testCase${index + 1}() {
          const step = ${stepImplementation.trim()};
          
          try {
            const executeParams = {
              inputData: ${JSON.stringify(test.inputData)},
              ${test.resumeData ? `resumeData: ${JSON.stringify(test.resumeData)},` : ''}
              runtimeContext: {
                get: (key) => null,
                set: (key, value) => {},
              },
              suspend: async (suspendData) => {
                ${test.expected.suspended ? 
                  `console.log('Step suspended as expected with data:', JSON.stringify(suspendData));
                   return;` : 
                  `throw new Error('Step suspended unexpectedly');`
                }
              },
            };
            
            ${test.expected.suspended ? 
              `// Check if suspend is called
              let suspendCalled = false;
              const mockSuspend = async (suspendData) => {
                suspendCalled = true;
                console.log('Step suspended with data:', JSON.stringify(suspendData));
              };
              
              const result = await step.execute({
                ...executeParams,
                suspend: mockSuspend,
              });
              
              if (!suspendCalled) {
                throw new Error('Expected step to suspend, but it did not');
              }
              console.log('✅ Test passed: Step suspended as expected');` :
              
              test.expected.error ?
              `// Expect error
              try {
                const result = await step.execute(executeParams);
                throw new Error('Expected step to throw error, but it succeeded');
              } catch (error) {
                console.log('✅ Test passed: Step threw error as expected');
              }` :
              
              `// Expect success with specific output
              const result = await step.execute(executeParams);
              const expectedOutput = ${JSON.stringify(test.expected.output || {})};
              
              // Compare result with expected output
              for (const key of Object.keys(expectedOutput)) {
                if (JSON.stringify(result[key]) !== JSON.stringify(expectedOutput[key])) {
                  throw new Error(\`Output mismatch for key "\${key}"\`);
                }
              }
              
              console.log('✅ Test passed: Step returned expected output');`
            }
          } catch (error) {
            console.error(\`❌ Test failed: \${error.message}\`);
            throw error;
          }
        }
      `;
      return testFunction;
    }).join('\n\n');
    
    const testScript = `
      import { z } from 'zod';
      
      async function runAllTests() {
        ${testCases}
        
        // Run all test cases
        ${tests.map((_, index) => `await testCase${index + 1}();`).join('\n        ')}
        
        return true;
      }
      
      runAllTests()
        .then(() => {
          console.log('All tests passed successfully');
          process.exit(0);
        })
        .catch(error => {
          console.error('Tests failed:', error.message);
          process.exit(1);
        });
    `;
    
    const result = await runner.runTest(testScript);
    return result.success;
  } finally {
    await runner.close();
  }
}

/**
 * Test a Mastra vNext workflow implementation
 */
export async function testWorkflow(
  workflowImplementation: string,
  tests: WorkflowTestConfig[],
  apiKey: string = process.env.E2B_API_KEY || ''
): Promise<boolean> {
  const runner = new E2BTestRunner({ apiKey, debug: false });
  
  try {
    const testCases = tests.map((test, index) => {
      const testFunction = `
        // Test case ${index + 1}: ${test.name}
        async function testCase${index + 1}() {
          const workflow = ${workflowImplementation.trim()};
          
          try {
            const result = await workflow.start({
              inputData: ${JSON.stringify(test.inputData)},
            });
            
            ${test.expected.suspendedSteps ? 
              `// Check if workflow suspended at expected steps
              if (result.status !== 'suspended') {
                throw new Error('Expected workflow to be suspended, but it was not');
              }
              
              const expectedSuspendedSteps = ${JSON.stringify(test.expected.suspendedSteps)};
              const actualSuspendedSteps = result.suspended.map(path => path[0]);
              
              // Check if all expected steps are suspended
              for (const step of expectedSuspendedSteps) {
                if (!actualSuspendedSteps.includes(step)) {
                  throw new Error(\`Expected step "\${step}" to be suspended, but it was not\`);
                }
              }
              
              console.log('✅ Test passed: Workflow suspended at expected steps');
              
              ${test.resumeData ? 
                `// Test resume functionality
                const resumeResult = await workflow.resume({
                  step: result.suspended[0],
                  resumeData: ${JSON.stringify(test.resumeData)},
                });
                
                // Check final output if specified
                ${test.expected.output ? 
                  `const expectedOutput = ${JSON.stringify(test.expected.output)};
                  for (const key of Object.keys(expectedOutput)) {
                    if (JSON.stringify(resumeResult[key]) !== JSON.stringify(expectedOutput[key])) {
                      throw new Error(\`Resume output mismatch for key "\${key}"\`);
                    }
                  }
                  console.log('✅ Test passed: Workflow resume returned expected output');` : 
                  `console.log('Workflow resumed successfully');`
                }` : 
                ''
              }` :
              
              test.expected.error ?
              `// Expect error
              if (result.status !== 'failed') {
                throw new Error('Expected workflow to fail, but it succeeded');
              }
              console.log('✅ Test passed: Workflow failed as expected');` :
              
              `// Expect success with specific output
              if (result.status !== 'success') {
                throw new Error(\`Expected workflow to succeed, but it was "\${result.status}"\`);
              }
              
              ${test.expected.output ? 
                `const expectedOutput = ${JSON.stringify(test.expected.output)};
                for (const key of Object.keys(expectedOutput)) {
                  if (JSON.stringify(result.output[key]) !== JSON.stringify(expectedOutput[key])) {
                    throw new Error(\`Output mismatch for key "\${key}"\`);
                  }
                }` : 
                ''
              }
              
              console.log('✅ Test passed: Workflow returned expected output');`
            }
          } catch (error) {
            console.error(\`❌ Test failed: \${error.message}\`);
            throw error;
          }
        }
      `;
      return testFunction;
    }).join('\n\n');
    
    const testScript = `
      import { z } from 'zod';
      
      async function runAllTests() {
        ${testCases}
        
        // Run all test cases
        ${tests.map((_, index) => `await testCase${index + 1}();`).join('\n        ')}
        
        return true;
      }
      
      runAllTests()
        .then(() => {
          console.log('All tests passed successfully');
          process.exit(0);
        })
        .catch(error => {
          console.error('Tests failed:', error.message);
          process.exit(1);
        });
    `;
    
    const result = await runner.runTest(testScript);
    return result.success;
  } finally {
    await runner.close();
  }
}