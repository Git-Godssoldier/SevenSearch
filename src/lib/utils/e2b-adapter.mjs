/**
 * E2B Code Interpreter Adapter (ESM version)
 * 
 * This provides a compatibility layer for the @e2b/code-interpreter library, 
 * allowing us to use existing code without having to refactor everything.
 */

// Mock Sandbox implementation - will be replaced with actual implementation when available
class Sandbox {
  constructor(options = {}) {
    this.options = options;
  }

  async runCode(code) {
    console.log("Executing code in mock sandbox:", code.substring(0, 100) + (code.length > 100 ? '...' : ''));
    // This is a simplified mock that just returns the code as text
    return {
      text: `Result: ${code.length} characters of code executed`,
      logs: ["[Mock] Code execution attempted"]
    };
  }

  async close() {
    // Mock close method
    console.log("Closing mock sandbox");
  }

  static async create(options = {}) {
    return new Sandbox(options);
  }
}

/**
 * Code Interpreter
 * 
 * This is a simplified compatibility adapter for the E2B Code Interpreter.
 */
export class CodeInterpreter {
  /**
   * Private constructor - use create() static method instead
   */
  constructor(sandbox) {
    this.sandbox = sandbox;
    
    // Provide a notebook interface that wraps the runCode method
    this.notebook = {
      execCell: async (code) => {
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
   * @param {Object} options Configuration options
   * @param {string} options.apiKey E2B API key
   * @returns {Promise<CodeInterpreter>} A new CodeInterpreter instance
   */
  static async create(options = {}) {
    const sandbox = await Sandbox.create({
      apiKey: options.apiKey,
    });
    
    return new CodeInterpreter(sandbox);
  }

  /**
   * Close the sandbox
   */
  async close() {
    await this.sandbox.close();
  }
}

export default CodeInterpreter;