/**
 * Type definitions for E2B testing framework
 */

// E2B sandbox type (simplified)
export interface E2BSandbox {
  filesystem: {
    writeFile: (params: { path: string; content: string }) => Promise<void>;
    readFile: (params: { path: string }) => Promise<{ content: string }>;
    listDir: (params: { path: string }) => Promise<{ entries: string[] }>;
  };
  process: {
    start: (params: {
      cmd: string;
      cwd?: string;
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
      env?: Record<string, string>;
    }) => Promise<E2BProcess>;
  };
  close: () => Promise<void>;
}

// E2B process type
export interface E2BProcess {
  wait: () => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  kill: () => Promise<void>;
}

// Test event type
export interface TestEvent {
  type: string;
  timestamp: number;
  data: any;
}

// Search provider type
export type SearchProviderName = 'exa' | 'jina' | 'firecrawl';

// Search result interface (simplified)
export interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
  source?: string;
  score?: number;
  metadata?: Record<string, any>;
}

// Step interface (simplified)
export interface Step {
  id: string;
  execute: (context: StepContext) => Promise<any>;
}

// Step context interface
export interface StepContext {
  inputData: Record<string, any>;
  stepOutputs?: Record<string, any>;
  suspend?: (data: any) => Promise<void>;
}

// Workflow interface (simplified)
export interface Workflow {
  name: string;
  description: string;
  steps: Record<string, Step>;
  then: (step: Step) => Workflow;
}

// Workflow config interfaces
export interface BaseWorkflowConfig {
  query: string;
  searchId: string;
  userId: string;
}

export interface SearchWorkflowConfig extends BaseWorkflowConfig {
  providers: SearchProviderName[];
}

export interface EnhancedSearchWorkflowConfig extends SearchWorkflowConfig {
  includeDeepSearch: boolean;
  includeHumanReview: boolean;
}

// Test result interface
export interface TestResult {
  success: boolean;
  error?: string;
  result?: any;
  stdout?: string;
  stderr?: string;
}