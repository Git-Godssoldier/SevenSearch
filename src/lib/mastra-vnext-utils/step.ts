/**
 * Step utility module for Mastra vNext
 * This provides the base Step class and utilities
 */
import { z } from 'zod';

export interface StepConfig {
  id: string;
  description?: string;
  timeout?: number;
}

export interface StepInput {
  [key: string]: any;
}

export interface StepOutput {
  [key: string]: any;
}

export interface StepContext {
  workflowId?: string;
  stepId?: string;
  [key: string]: any;
}

export interface SuspendData {
  [key: string]: any;
}

export interface ResumeData {
  [key: string]: any;
}

export interface ExecuteParams<
  TInput extends StepInput = StepInput,
  TContext extends StepContext = StepContext,
  TResumeData extends ResumeData = ResumeData
> {
  inputData: TInput;
  mastra?: any;
  getStepResult?: (step: any) => any;
  getInitData?: <T>() => T;
  runtimeContext?: {
    get: (key: string) => any;
    set: (key: string, value: any) => void;
  };
  resumeData?: TResumeData;
  suspend?: (suspendData: SuspendData) => Promise<void>;
}

export abstract class Step<
  TInput extends StepInput = StepInput,
  TOutput extends StepOutput = StepOutput,
  TContext extends StepContext = StepContext,
  TResumeData extends ResumeData = ResumeData,
  TSuspendData extends SuspendData = SuspendData
> {
  id: string;
  description?: string;
  timeout: number;
  
  constructor(config: StepConfig) {
    this.id = config.id;
    this.description = config.description;
    this.timeout = config.timeout || 30000; // Default 30s timeout
  }

  abstract execute(params: ExecuteParams<TInput, TContext, TResumeData>): Promise<TOutput>;
  
  async validateInput(input: TInput): Promise<TInput> {
    return input;
  }
  
  async validateOutput(output: TOutput): Promise<TOutput> {
    return output;
  }
}

export const createStep = <
  TInput extends StepInput = StepInput,
  TOutput extends StepOutput = StepOutput,
  TContext extends StepContext = StepContext,
  TResumeData extends ResumeData = ResumeData,
  TSuspendData extends SuspendData = SuspendData
>(
  config: {
    id: string;
    description?: string;
    timeout?: number;
    inputSchema: z.ZodType<TInput>;
    outputSchema: z.ZodType<TOutput>;
    resumeSchema?: z.ZodType<TResumeData>;
    suspendSchema?: z.ZodType<TSuspendData>;
    execute: (params: ExecuteParams<TInput, TContext, TResumeData>) => Promise<TOutput>;
  }
) => {
  return new class extends Step<TInput, TOutput, TContext, TResumeData, TSuspendData> {
    constructor() {
      super({
        id: config.id,
        description: config.description,
        timeout: config.timeout
      });
    }
    
    async execute(params: ExecuteParams<TInput, TContext, TResumeData>): Promise<TOutput> {
      return config.execute(params);
    }
  }();
};