/**
 * E2B Code Interpreter Adapter
 * 
 * This provides a compatibility layer for the @e2b/code-interpreter library, 
 * allowing us to use existing code without having to refactor everything.
 */

// Mock Sandbox implementation - will be replaced with actual implementation when available
class Sandbox {
  constructor(private options: any = {}) {}

  async runCode(code: string): Promise<{ text?: string; logs?: string[] }> {
    console.log("Executing code in mock sandbox:", code.substring(0, 100) + (code.length > 100 ? '...' : ''));
    // This is a simplified mock that just returns the code as text
    return {
      text: `Result: ${code.length} characters of code executed`,
      logs: ["[Mock] Code execution attempted"]
    };
  }

  async close(): Promise<void> {
    // Mock close method
    console.log("Closing mock sandbox");
  }

  static async create(options: any = {}): Promise<Sandbox> {
    return new Sandbox(options);
  }
}

/**
 * Notebook Cell Execution Result
 */
export interface NotebookExecution {
  text: string;
  logs: string[];
  error?: Error;
  exitCode?: number;
  output?: string[];
}

/**
 * Notebook Interface
 */
export interface Notebook {
  /**
   * Execute a notebook cell with the given code
   * @param code The code to execute
   * @returns The execution result
   */
  execCell(code: string): Promise<NotebookExecution>;
}

/**
 * Code Interpreter
 * 
 * This is a simplified compatibility adapter for the E2B Code Interpreter.
 */
export class CodeInterpreter {
  private sandbox: Sandbox;
  public notebook: Notebook;

  /**
   * Private constructor - use create() static method instead
   */
  private constructor(sandbox: Sandbox) {
    this.sandbox = sandbox;
    
    // Provide a notebook interface that wraps the runCode method
    this.notebook = {
      execCell: async (code: string): Promise<NotebookExecution> => {
        try {
          const result = await this.sandbox.runCode(code);
          return {
            text: result.text || '',
            logs: result.logs || [],
            output: result.logs || [],
            exitCode: 0
          };
        } catch (error) {
          return {
            text: '',
            logs: [],
            output: [],
            error: error instanceof Error ? error : new Error(String(error)),
            exitCode: 1
          };
        }
      }
    };
  }

  /**
   * Create a new CodeInterpreter instance
   * @param options Configuration options
   * @returns A new CodeInterpreter instance
   */
  static async create(options: { apiKey?: string } = {}): Promise<CodeInterpreter> {
    const sandbox = await Sandbox.create({
      apiKey: options.apiKey,
    });
    
    return new CodeInterpreter(sandbox);
  }

  /**
   * Close the sandbox
   */
  async close(): Promise<void> {
    await this.sandbox.close();
  }
}

export default CodeInterpreter;