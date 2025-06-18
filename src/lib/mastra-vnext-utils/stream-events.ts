import { TextEncoder } from 'util';
import { streamChunkOutput } from '../mastra-vnext-schemas';
import type { z } from 'zod';
import { EventEmitter } from 'events';

/**
 * Event Types for vNext Events
 */
export enum EventType {
  // Workflow Events
  WORKFLOW_STARTED = 'workflow_started',
  WORKFLOW_COMPLETED = 'workflow_completed',
  WORKFLOW_FAILED = 'workflow_failed',
  WORKFLOW_SUSPENDED = 'workflow_suspended',
  WORKFLOW_RESUMED = 'workflow_resumed',
  WORKFLOW_AWAITING_USER_INPUT = 'workflow_awaiting_user_input',

  // Step Events
  STEP_RUNNING = 'step_running',
  STEP_COMPLETED = 'step_completed',
  STEP_FAILED = 'step_failed',
  STEP_SKIPPED = 'step_skipped',

  // Progress Events
  PROGRESS_UPDATE = 'progress_update',
  ENHANCING_QUERY = 'enhancing_query',
  SEARCHING = 'searching',
  READING = 'reading',
  SYNTHESIZING = 'synthesizing',

  // Error Events
  ERROR = 'error',
  WARNING = 'warning',

  // Custom Events
  LINK_SCRAPED = 'link_scraped',
  RESULTS_FOUND = 'results_found',
  BRANCH_SELECTED = 'branch_selected',
  CITATION_ADDED = 'citation_added',

  // Other
  UNKNOWN = 'unknown'
}

/**
 * Client-side step mapping
 */
export interface StepMap {
  id: string;
  clientStep: number;
  clientType: string;
  description: string;
}

/**
 * EventStreamWriter
 *
 * A utility class for converting workflow events to client-friendly stream updates.
 * Handles transforming Mastra vNext events into standardized formats for client consumption.
 */
export class EventStreamWriter {
  private writable?: WritableStream;
  private writer?: WritableStreamDefaultWriter;
  private encoder: TextEncoder;
  private lastUpdateTime: number = 0;
  private readonly UPDATE_THROTTLE_MS: number = 100; // Minimum ms between updates
  private stepMap: StepMap[];

  /**
   * Create a new EventStreamWriter
   * @param writable The WritableStream to write events to
   */
  constructor(writable?: WritableStream) {
    if (writable) {
      this.writable = writable;
      this.writer = writable.getWriter();
    }
    this.encoder = new TextEncoder();

    // Define the step mapping for client-side rendering
    this.stepMap = [
      { id: 'planning-query-enhancement', clientStep: 1, clientType: 'enhancing', description: 'Enhancing your search term' },
      { id: 'exa-search', clientStep: 2, clientType: 'searching', description: 'Searching Exa' },
      { id: 'jina-search', clientStep: 2, clientType: 'searching', description: 'Searching Jina AI' },
      { id: 'deep-search', clientStep: 2, clientType: 'searching', description: 'Performing comprehensive search' },
      { id: 'aggregate-deduplicate', clientStep: 2, clientType: 'searching', description: 'Aggregating search results' },
      { id: 'scrape-webpage', clientStep: 3, clientType: 'reading', description: 'Reading sources' },
      { id: 'human-review', clientStep: 3, clientType: 'interactive', description: 'Awaiting your input' },
      { id: 'rag-step', clientStep: 4, clientType: 'reading', description: 'Analyzing content relevance' },
      { id: 'summary-step', clientStep: 5, clientType: 'wrapping', description: 'Synthesizing information' }
    ];
  }

  /**
   * Get client step info from the step ID
   * @param stepId The vNext step ID
   * @returns The client step mapping info
   */
  private getStepInfo(stepId: string): StepMap {
    return this.stepMap.find(step => step.id === stepId) || {
      id: stepId,
      clientStep: 0,
      clientType: 'unknown',
      description: 'Unknown step'
    };
  }

  /**
   * Convert a workflow event to a client update
   * @param event The workflow event to convert
   * @returns A client update object
   */
  convertEventToUpdate(event: any): z.infer<typeof streamChunkOutput> | null {
    // Handle different event types
    if (!event) return null;

    // Handle watch events (step events)
    if (event.type === 'watch' && event.payload?.currentStep) {
      return this.convertStepEventToUpdate(event);
    }

    // Handle workflow events
    if (event.type === 'workflow') {
      return this.convertWorkflowEventToUpdate(event);
    }

    // Handle branch events
    if (event.type === 'branch') {
      return this.convertBranchEventToUpdate(event);
    }

    // Handle progress events
    if (event.type === 'progress') {
      return this.convertProgressEventToUpdate(event);
    }

    // Handle direct custom events
    if (event.type === 'custom') {
      return this.convertCustomEventToUpdate(event);
    }

    // If we couldn't match the event type, return null
    console.warn('[EventStreamWriter] Unknown event type:', event.type);
    return null;
  }

  /**
   * Convert a step event to a client update
   */
  private convertStepEventToUpdate(event: any): z.infer<typeof streamChunkOutput> | null {
    const { currentStep } = event.payload;
    if (!currentStep || !currentStep.id) {
      return null;
    }

    const stepId = currentStep.id;
    const stepInfo = this.getStepInfo(stepId);

    // Base update object
    const update: z.infer<typeof streamChunkOutput> = {
      step: stepInfo.clientStep,
      type: `${stepInfo.clientType}_${currentStep.status}`,
      payload: {
        ...currentStep.payload || {},
        description: stepInfo.description,
        status: currentStep.status,
        stepId: stepId
      }
    };

    // Add special handling for specific steps
    switch (stepId) {
      case 'planning-query-enhancement':
        if (currentStep.status === 'completed' && currentStep.payload?.enhancedQuery) {
          update.payload.enhancedQuery = currentStep.payload.enhancedQuery;
          update.payload.enhancedQueryLoaded = true;
        }
        break;

      case 'scrape-webpage':
        if (currentStep.status === 'completed' && currentStep.payload?.link) {
          update.step = 3; // Reading step
          update.type = 'reading_update';
          update.payload.link = currentStep.payload.link;
          update.payload.contentBlocks = currentStep.payload.contentChunks?.length || 0;
        }
        break;

      case 'exa-search':
      case 'jina-search':
      case 'deep-search':
        if (currentStep.status === 'completed' && currentStep.payload?.results) {
          update.step = 2; // Search step
          update.type = 'searching_completed';
          update.payload.resultCount = currentStep.payload.results.length;
          update.payload.provider = stepId.split('-')[0]; // 'exa', 'jina', or 'deep'
        }
        break;
    }

    // Add error information if status is failed
    if (currentStep.status === 'failed') {
      update.error = true;
      update.errorType = currentStep.payload?.error || 'unknown_error';
      update.payload.message = currentStep.payload?.message || 'An error occurred';
    }

    return update;
  }

  /**
   * Convert a workflow event to a client update
   */
  private convertWorkflowEventToUpdate(event: any): z.infer<typeof streamChunkOutput> | null {
    if (!event.payload) return null;

    const { status, searchId, query, metadata, error, suspended } = event.payload;

    // Base workflow update
    const update: z.infer<typeof streamChunkOutput> = {
      step: 0, // Workflow events are typically step 0 (global)
      type: `workflow_${status}`,
      payload: {
        searchId,
        query,
        ...metadata
      }
    };

    // Add error information for failed workflows
    if (status === 'failed' && error) {
      update.error = true;
      update.errorType = error.code || 'workflow_failure';
      update.payload.message = error.message || 'Workflow failed';
    }

    // Add suspension information for suspended workflows
    if (status === 'suspended' && suspended) {
      // Extract the suspended step ID if available
      const stepId = suspended.stepId || 'human-review';
      const stepInfo = this.getStepInfo(stepId);

      // Check if this is a human-review suspension
      if (stepId === 'human-review') {
        update.step = stepInfo.clientStep;
        update.type = EventType.WORKFLOW_AWAITING_USER_INPUT;
        update.payload = {
          ...update.payload,
          suspendedStep: stepId,
          suspendData: suspended.data || {},
          description: 'Awaiting your input to continue the search',
          suspendedAt: new Date().toISOString()
        };
      } else {
        // Generic suspension
        update.type = EventType.WORKFLOW_SUSPENDED;
        update.payload.suspendedStep = stepId;
        update.payload.suspendReason = suspended.reason || 'unknown';
      }
    }

    // Add completion information
    if (status === 'completed') {
      update.step = 5; // Final step
      update.type = 'workflow_completed';
    }

    return update;
  }

  /**
   * Convert a branch event to a client update
   */
  private convertBranchEventToUpdate(event: any): z.infer<typeof streamChunkOutput> | null {
    if (!event.payload) return null;

    const { branchId, condition, result } = event.payload;

    return {
      step: 2, // Branches typically happen during search phase
      type: 'branch_selected',
      payload: {
        branchId,
        condition: condition || 'unknown',
        selected: result === true,
        description: branchId === 'complex'
          ? 'Using deep search for complex query'
          : 'Using standard search approach'
      }
    };
  }

  /**
   * Convert a progress event to a client update
   */
  private convertProgressEventToUpdate(event: any): z.infer<typeof streamChunkOutput> | null {
    if (!event.payload) return null;

    const { step, progress, message } = event.payload;
    const stepInfo = step ? this.getStepInfo(step) : { clientStep: 0, clientType: 'progress' };

    return {
      step: stepInfo.clientStep,
      type: 'progress_update',
      payload: {
        progress: progress || 0,
        message: message || 'Processing',
        stepId: step
      }
    };
  }

  /**
   * Convert a custom event to a client update
   */
  private convertCustomEventToUpdate(event: any): z.infer<typeof streamChunkOutput> | null {
    if (!event.payload) return null;

    // Map custom events to client-friendly format
    const { eventType, data, step } = event.payload;
    const stepInfo = step ? this.getStepInfo(step) : { clientStep: 0, clientType: 'custom' };

    return {
      step: stepInfo.clientStep,
      type: eventType || 'custom_event',
      payload: data || {}
    };
  }

  /**
   * Process a workflow event and write it to the stream
   * @param event The workflow event to process
   */
  async processEvent(event: any): Promise<void> {
    const update = this.convertEventToUpdate(event);

    if (update) {
      await this.throttledWrite(update);
    }
  }

  /**
   * Write a client update to the stream with throttling
   * @param update The client update to write
   */
  async throttledWrite(update: z.infer<typeof streamChunkOutput>): Promise<boolean> {
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdateTime;

    if (timeSinceLastUpdate < this.UPDATE_THROTTLE_MS) {
      await new Promise(resolve => setTimeout(resolve, this.UPDATE_THROTTLE_MS - timeSinceLastUpdate));
    }

    // When used in test context, writer may not be available
    if (!this.writer) {
      console.log(`[EventStreamWriter] Test mode - update: ${update.type} (step ${update.step})`);
      this.lastUpdateTime = Date.now();
      return true;
    }

    try {
      console.log(`[EventStreamWriter] Sending update: ${update.type} (step ${update.step})`);
      await this.writer.write(this.encoder.encode(`${JSON.stringify(update)}\n`));
      this.lastUpdateTime = Date.now();
      return true;
    } catch (error) {
      console.error('[EventStreamWriter] Error writing to stream:', error);
      return false;
    }
  }

  /**
   * Send a manual update to the client
   * @param step The step number
   * @param type The update type
   * @param payload The update payload
   * @param error Whether this is an error update
   * @param errorType The error type (if an error)
   */
  async sendManualUpdate(
    step: number,
    type: string,
    payload: any = {},
    error: boolean = false,
    errorType?: string
  ): Promise<boolean> {
    const update: z.infer<typeof streamChunkOutput> = {
      step,
      type,
      payload,
      ...(error && { error: true }),
      ...(errorType && { errorType })
    };

    return this.throttledWrite(update);
  }

  /**
   * Send a workflow start update to the client
   * @param query The search query
   * @param searchId The search ID
   */
  async sendWorkflowStarted(query: string, searchId: string): Promise<boolean> {
    return this.sendManualUpdate(0, EventType.WORKFLOW_STARTED, { query, searchId });
  }

  /**
   * Send a workflow completion update to the client
   * @param searchId The search ID
   * @param metadata Additional metadata
   */
  async sendWorkflowCompleted(searchId: string, metadata: any = {}): Promise<boolean> {
    return this.sendManualUpdate(5, EventType.WORKFLOW_COMPLETED, {
      searchId,
      metadata,
      success: true
    });
  }

  /**
   * Send a workflow suspension update to the client
   * @param searchId The search ID
   * @param stepId The ID of the step causing suspension
   * @param suspendData Data for the client during suspension
   */
  async sendWorkflowSuspended(searchId: string, stepId: string, suspendData: any = {}): Promise<boolean> {
    // Get the client step information
    const stepInfo = this.getStepInfo(stepId);

    // Check if this is a human-review suspension
    if (stepId === 'human-review') {
      return this.sendManualUpdate(stepInfo.clientStep, EventType.WORKFLOW_AWAITING_USER_INPUT, {
        searchId,
        suspendedStep: stepId,
        suspendData,
        description: 'Awaiting your input to continue the search',
        suspendedAt: new Date().toISOString()
      });
    } else {
      // Generic suspension
      return this.sendManualUpdate(stepInfo.clientStep, EventType.WORKFLOW_SUSPENDED, {
        searchId,
        suspendedStep: stepId,
        suspendReason: 'workflow_suspended',
        suspendData,
        suspendedAt: new Date().toISOString()
      });
    }
  }

  /**
   * Send a workflow resumption update to the client
   * @param searchId The search ID
   * @param stepId The ID of the step that was suspended
   */
  async sendWorkflowResumed(searchId: string, stepId: string): Promise<boolean> {
    // Get the client step information
    const stepInfo = this.getStepInfo(stepId);

    return this.sendManualUpdate(stepInfo.clientStep, EventType.WORKFLOW_RESUMED, {
      searchId,
      resumedStep: stepId,
      resumedAt: new Date().toISOString(),
      description: `Search continuing from ${stepInfo.description}`
    });
  }

  /**
   * Send an error update to the client
   * @param message The error message
   * @param errorType The error type
   */
  async sendError(message: string, errorType: string = 'unknown_error'): Promise<boolean> {
    return this.sendManualUpdate(0, EventType.ERROR, { message }, true, errorType);
  }

  /**
   * Create an event emitter helper for vNext steps
   * @param emitter The vNext EventEmitter to wrap
   * @param stepId The ID of the current step
   * @returns Helper functions for common events
   */
  static createStepEventHelpers(emitter: EventEmitter, stepId: string) {
    return {
      /**
       * Emit a running event
       * @param payload Additional payload data
       */
      emitRunning: async (payload: any = {}) => {
        await emitter.emit('watch', {
          type: 'watch',
          payload: {
            currentStep: {
              id: stepId,
              status: 'running',
              payload
            }
          },
          eventTimestamp: new Date()
        });
      },

      /**
       * Emit a completed event
       * @param payload Additional payload data
       */
      emitCompleted: async (payload: any = {}) => {
        await emitter.emit('watch', {
          type: 'watch',
          payload: {
            currentStep: {
              id: stepId,
              status: 'completed',
              payload
            }
          },
          eventTimestamp: new Date()
        });
      },

      /**
       * Emit a failed event
       * @param message Error message
       * @param error Error object or string
       */
      emitFailed: async (message: string, error: any = null) => {
        await emitter.emit('watch', {
          type: 'watch',
          payload: {
            currentStep: {
              id: stepId,
              status: 'failed',
              payload: {
                message,
                error: error instanceof Error ? error.message : String(error)
              }
            }
          },
          eventTimestamp: new Date()
        });
      },

      /**
       * Emit a progress update
       * @param progress Progress percentage (0-100)
       * @param message Progress message
       */
      emitProgress: async (progress: number, message: string) => {
        await emitter.emit('progress', {
          type: 'progress',
          payload: {
            step: stepId,
            progress,
            message
          },
          eventTimestamp: new Date()
        });
      },

      /**
       * Emit a custom event
       * @param eventType Custom event type
       * @param data Event data
       */
      emitCustom: async (eventType: string, data: any = {}) => {
        await emitter.emit('custom', {
          type: 'custom',
          payload: {
            eventType,
            data,
            step: stepId
          },
          eventTimestamp: new Date()
        });
      }
    };
  }
  
  /**
   * Close the stream writer
   */
  async close(): Promise<void> {
    // If there's no writer (test mode), just return
    if (!this.writer) {
      return;
    }

    try {
      // Delay closing by a short time to ensure all queued writes complete
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.writer.close();
      console.log('[EventStreamWriter] Stream writer closed properly');
    } catch (closeError) {
      console.error('[EventStreamWriter] Error closing stream writer:', closeError);
      // Attempt a last-ditch effort to close the stream
      try {
        this.writer.close().catch(() => {});
      } catch {} // Ignore any errors in this last attempt
    }
  }
}