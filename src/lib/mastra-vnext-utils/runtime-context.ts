import type { z } from 'zod';

/**
 * Runtime context for Mastra vNext workflow steps
 */

export interface RuntimeContextValue {
  key: string;
  value: any;
  metadata?: Record<string, any>;
}

export class RuntimeContext {
  private contextValues: Map<string, RuntimeContextValue>;

  constructor(initialValues?: Record<string, any>) {
    this.contextValues = new Map();
    
    if (initialValues) {
      Object.entries(initialValues).forEach(([key, value]) => {
        this.set(key, value);
      });
    }
  }

  /**
   * Set a value in the context
   */
  set(key: string, value: any, metadata?: Record<string, any>): void {
    this.contextValues.set(key, {
      key,
      value,
      metadata
    });
  }

  /**
   * Get a value from the context
   */
  get(key: string): any {
    return this.contextValues.get(key)?.value;
  }

  /**
   * Get a value with its metadata
   */
  getWithMetadata(key: string): RuntimeContextValue | undefined {
    return this.contextValues.get(key);
  }

  /**
   * Check if a key exists in the context
   */
  has(key: string): boolean {
    return this.contextValues.has(key);
  }

  /**
   * Delete a key from the context
   */
  delete(key: string): boolean {
    return this.contextValues.delete(key);
  }

  /**
   * Get all keys in the context
   */
  keys(): string[] {
    return Array.from(this.contextValues.keys());
  }

  /**
   * Get all values in the context
   */
  values(): any[] {
    return Array.from(this.contextValues.values()).map(v => v.value);
  }

  /**
   * Get all entries in the context
   */
  entries(): [string, any][] {
    return Array.from(this.contextValues.entries()).map(([k, v]) => [k, v.value]);
  }

  /**
   * Convert context to serializable object
   */
  toJSON(): Record<string, any> {
    const result: Record<string, any> = {};
    this.contextValues.forEach((value, key) => {
      result[key] = value.value;
    });
    return result;
  }

  /**
   * Create context from serialized object
   */
  static fromJSON(json: Record<string, any>): RuntimeContext {
    return new RuntimeContext(json);
  }
}

/**
 * Creates a RuntimeContext for Mastra vNext
 * 
 * @param contextData The context data to initialize with
 * @returns A new RuntimeContext instance
 */
export function createRuntimeContext(
  contextData: Record<string, any> = {}
): RuntimeContext {
  // Create a new RuntimeContext
  const runtimeContext = new RuntimeContext();
  
  // Set all provided context values
  Object.entries(contextData).forEach(([key, value]) => {
    if (value !== undefined) {
      runtimeContext.set(key, value);
    }
  });
  
  // Add helper methods for streaming updates
  runtimeContext.set('pushUpdateToClient', (update: any) => {
    // This is a placeholder for backward compatibility
    console.log('[RuntimeContext] pushUpdateToClient called:', update);
    return Promise.resolve();
  });
  
  return runtimeContext;
}

/**
 * Creates a RuntimeContext from a session context
 * 
 * @param session The session object
 * @param searchId The search ID
 * @param additionalContext Additional context to include
 * @returns A new RuntimeContext instance
 */
export function createRuntimeContextFromSession(
  session: any,
  searchId: string,
  additionalContext: Record<string, any> = {}
): RuntimeContext {
  // Extract API keys from session and environment
  const context = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    SCRAPYBARA_API_KEY: session?.user?.apiKey || '',
    EXA_API_KEY: process.env.EXA_API_KEY || '',
    FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
    JINA_API_KEY: process.env.JINA_API_KEY || '',
    userId: session?.user?.id || '',
    searchId,
  };
  
  // Merge additional context
  return createRuntimeContext({
    ...context,
    ...additionalContext
  });
}