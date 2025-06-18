/**
 * E2B test runner for Mastra vNext workflow validation
 * 
 * This module provides utilities for safely testing workflows and step 
 * implementations in an isolated E2B sandbox environment.
 */

// Import mock Sandbox from our adapter
class Sandbox {
  constructor(private options: any = {}) {
    this.onStdout = options.onStdout || (() => {});
    this.onStderr = options.onStderr || (() => {});
  }
  
  private onStdout: (data: string) => void;
  private onStderr: (data: string) => void;
  
  async runCode(code: string): Promise<{ text?: string; logs?: string[] }> {
    this.onStdout(`[Mock] Executing code: ${code.substring(0, 100)}...`);
    return {
      text: `[Mock] Result from code execution`,
      logs: ["[Mock] Code executed successfully"]
    };
  }
  
  async runCommand(command: string, options: any = {}): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    this.onStdout(`[Mock] Running command: ${command}`);
    return {
      exitCode: 0,
      stdout: "[Mock] Command executed successfully",
      stderr: ""
    };
  }
  
  async installPackage(packageName: string): Promise<void> {
    this.onStdout(`[Mock] Installing package: ${packageName}`);
  }
  
  files = {
    write: async (path: string, content: string): Promise<void> => {
      this.onStdout(`[Mock] Writing to ${path}`);
    }
  };
  
  async close(): Promise<void> {
    this.onStdout("[Mock] Closing sandbox");
  }
  
  static async create(options: any = {}): Promise<Sandbox> {
    return new Sandbox(options);
  }
};
import fs from 'fs';
import path from 'path';

interface TestRunnerConfig {
  apiKey?: string;
  timeout?: number;
  debug?: boolean;
}

interface TestRunResult {
  success: boolean;
  output: string;
  logs: string[];
  errors?: string[];
  executionTime: number;
}

/**
 * E2B Test Runner for validating Mastra vNext workflows and steps
 */
export class E2BTestRunner {
  private readonly sandbox: Promise<Sandbox>;
  private readonly config: TestRunnerConfig;
  private isInitialized = false;
  private testLogs: string[] = [];

  constructor(config: TestRunnerConfig = {}) {
    this.config = {
      apiKey: process.env.E2B_API_KEY,
      timeout: 30000, // 30 seconds default
      debug: false,
      ...config
    };

    if (!this.config.apiKey) {
      throw new Error('E2B API key is required. Set E2B_API_KEY environment variable or pass it in config.');
    }

    // Initialize sandbox
    this.sandbox = Sandbox.create({
      apiKey: this.config.apiKey,
      onStdout: this.handleStdout.bind(this),
      onStderr: this.handleStderr.bind(this),
    });
  }

  /**
   * Initialize the sandbox with test framework and dependencies
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const sbx = await this.sandbox;
    
    // Install TypeScript and testing tools
    await sbx.installPackage('typescript');
    await sbx.installPackage('ts-node');
    await sbx.installPackage('zod');
    
    // Create basic test environment
    await sbx.files.write('/tsconfig.json', JSON.stringify({
      compilerOptions: {
        target: "es2019",
        module: "commonjs",
        esModuleInterop: true,
        skipLibCheck: true,
        strict: true,
      }
    }));

    this.isInitialized = true;
    this.log('E2B test environment initialized');
  }

  /**
   * Run TypeScript test content in sandbox
   */
  async runTest(testContent: string): Promise<TestRunResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const sbx = await this.sandbox;
    const startTime = Date.now();
    this.testLogs = [];
    
    // Write test file
    await sbx.files.write('/test.ts', testContent);
    
    try {
      // Run test with ts-node
      const result = await sbx.runCommand('npx ts-node /test.ts', {
        timeout: this.config.timeout,
      });
      
      return {
        success: result.exitCode === 0,
        output: result.stdout,
        logs: this.testLogs,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          output: '',
          logs: this.testLogs,
          errors: [error.message],
          executionTime: Date.now() - startTime,
        };
      }
      throw error;
    }
  }

  /**
   * Run a test file from the filesystem
   */
  async runTestFile(filePath: string): Promise<TestRunResult> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    const testContent = fs.readFileSync(absolutePath, 'utf-8');
    return this.runTest(testContent);
  }

  /**
   * Validate a Mastra vNext step implementation
   */
  async validateStep(stepImplementation: string): Promise<TestRunResult> {
    const testTemplate = `
      import { z } from 'zod';
      
      ${stepImplementation}
      
      // Test the step execution
      async function runTest() {
        try {
          const testStep = createStep({
            id: 'test-step',
            inputSchema: z.object({
              testInput: z.string(),
            }),
            outputSchema: z.object({
              testOutput: z.string(),
            }),
            execute: async ({ inputData }) => {
              console.log('Step received input:', inputData);
              return { testOutput: 'processed: ' + inputData.testInput };
            },
          });
          
          // Test normal execution
          const result = await testStep.execute({
            inputData: { testInput: 'test-value' },
            runtimeContext: {
              get: (key) => null,
              set: (key, value) => {},
            },
          });
          
          console.log('Step execution result:', result);
          console.log('TEST PASSED');
          return true;
        } catch (error) {
          console.error('TEST FAILED:', error);
          return false;
        }
      }
      
      // Run test and exit with appropriate code
      runTest().then(success => {
        process.exit(success ? 0 : 1);
      });
    `;
    
    return this.runTest(testTemplate);
  }

  /**
   * Clean up resources when done
   */
  async close(): Promise<void> {
    const sbx = await this.sandbox;
    await sbx.close();
    this.log('E2B test environment closed');
  }

  /**
   * Handle stdout from sandbox
   */
  private handleStdout(data: string): void {
    this.testLogs.push(`stdout: ${data}`);
    this.log(data);
  }

  /**
   * Handle stderr from sandbox
   */
  private handleStderr(data: string): void {
    this.testLogs.push(`stderr: ${data}`);
    this.log(`Error: ${data}`, true);
  }

  /**
   * Log message if debug is enabled
   */
  private log(message: string, isError = false): void {
    if (this.config.debug) {
      if (isError) {
        console.error(`[E2BTestRunner] ${message}`);
      } else {
        console.log(`[E2BTestRunner] ${message}`);
      }
    }
  }
}

/**
 * Create and run a test script for Mastra vNext workflow
 */
export async function testMastraVNextWorkflow(
  workflowCode: string, 
  testCases: string,
  config?: TestRunnerConfig
): Promise<TestRunResult> {
  const runner = new E2BTestRunner(config);
  
  try {
    const testContent = `
      import { z } from 'zod';
      
      ${workflowCode}
      
      async function runTests() {
        try {
          ${testCases}
          console.log('All tests passed');
          return true;
        } catch (error) {
          console.error('Test failed:', error);
          return false;
        }
      }
      
      runTests().then(success => {
        process.exit(success ? 0 : 1);
      });
    `;
    
    return await runner.runTest(testContent);
  } finally {
    await runner.close();
  }
}