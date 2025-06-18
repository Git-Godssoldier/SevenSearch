import { z } from 'zod';
import { createStep } from '../mastra-vnext-utils/step';
import { EventStreamWriter } from '../mastra-vnext-utils/stream-events';
import { CodeInterpreter } from '../utils/e2b-adapter.mjs';

/**
 * Schema for code execution input
 */
const codeExecutionInputSchema = z.object({
  code: z.string().min(1).describe('JavaScript code to execute in the E2B sandbox'),
  data: z.any().optional().describe('Optional data to be used by the code'),
  options: z.object({
    timeout: z.number().min(1000).max(60000).optional().default(30000),
    memoryLimit: z.number().optional(),
    allowedPackages: z.array(z.string()).optional(),
  }).optional().default({}),
});

/**
 * Schema for code execution output
 */
const codeExecutionOutputSchema = z.object({
  result: z.any().describe('Result returned by the executed code'),
  executionTime: z.number().describe('Time taken to execute the code in milliseconds'),
  output: z.string().describe('Any console output from the code execution'),
  error: z.string().nullable().describe('Error message if execution failed'),
});

/**
 * Interface for the E2B execution environment
 */
interface ExecutionEnvironment {
  sandbox: CodeInterpreter;
  initialize: () => Promise<void>;
  execute: (code: string, data?: any) => Promise<any>;
  close: () => Promise<void>;
}

/**
 * Create an E2B execution environment
 */
async function createExecutionEnvironment(apiKey: string): Promise<ExecutionEnvironment> {
  let sandbox: CodeInterpreter | null = null;
  let isInitialized = false;

  return {
    sandbox: null as unknown as CodeInterpreter,
    
    async initialize(): Promise<void> {
      if (isInitialized) return;
      
      try {
        sandbox = await CodeInterpreter.create({
          apiKey,
        });
        this.sandbox = sandbox;
        isInitialized = true;
      } catch (error) {
        throw new Error(`Failed to initialize E2B sandbox: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    
    async execute(code: string, data?: any): Promise<any> {
      if (!isInitialized || !sandbox) {
        await this.initialize();
      }
      
      // Create a custom code block that includes the provided data
      const codeToExecute = data 
        ? `
          const providedData = ${JSON.stringify(data)};
          ${code}
        `
        : code;
      
      const execution = await this.sandbox.notebook.execCell(codeToExecute);
      return {
        result: execution.text || null,
        output: execution.output?.join('\n') || '',
      };
    },
    
    async close(): Promise<void> {
      if (sandbox) {
        await sandbox.close();
        sandbox = null;
        isInitialized = false;
      }
    }
  };
}

/**
 * Code Execution Step
 * 
 * Executes JavaScript code securely in an E2B sandbox environment
 * Can be used for data processing, analysis, and visualization tasks
 */
export const codeExecutionStep = createStep({
  id: 'code-execution-step',
  name: 'Code Execution',
  description: 'Securely executes JavaScript code in an isolated E2B sandbox environment',
  inputSchema: codeExecutionInputSchema,
  outputSchema: codeExecutionOutputSchema,
  
  async execute({ inputData, runtimeContext, emitter }) {
    const events = EventStreamWriter.createStepEventHelpers(emitter, 'code-execution-step');
    let environment: ExecutionEnvironment | null = null;
    
    try {
      const { code, data, options } = inputData;
      const apiKey = runtimeContext.get('E2B_API_KEY');
      
      if (!apiKey) {
        throw new Error('E2B_API_KEY is required in runtime context');
      }
      
      // Emit running status
      await events.emitRunning({
        message: 'Initializing code execution environment',
        codeLength: code.length,
      });
      
      // Initialize execution environment
      environment = await createExecutionEnvironment(apiKey);
      
      // Emit progress event
      await events.emitProgress(20, 'Environment initialized');
      
      // Execute the code
      await events.emitProgress(40, 'Executing code');
      const startTime = Date.now();
      
      const executionResult = await Promise.race([
        environment.execute(code, data),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Execution timed out')), options.timeout);
        }),
      ]);
      
      const executionTime = Date.now() - startTime;
      
      // Emit progress event
      await events.emitProgress(80, 'Processing execution results');
      
      // Prepare output
      const result = {
        result: executionResult.result,
        executionTime,
        output: executionResult.output,
        error: null,
      };
      
      // Emit custom event with execution details
      await events.emitCustom('execution_details', {
        executionTime,
        outputLength: executionResult.output.length,
      });
      
      // Emit completion event
      await events.emitCompleted({
        message: 'Code executed successfully',
        executionTime,
      });
      
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Code execution step failed:', errorMessage);
      
      // Emit failed event
      await events.emitFailed('Code execution failed', errorMessage);
      
      // Return error result
      return {
        result: null,
        executionTime: 0,
        output: '',
        error: errorMessage,
      };
      
    } finally {
      // Ensure environment is closed
      if (environment) {
        try {
          await environment.close();
        } catch (closeError) {
          console.error('Error closing environment:', closeError);
        }
      }
    }
  }
});

export default codeExecutionStep;