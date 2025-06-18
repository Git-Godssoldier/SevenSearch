/**
 * Dynamic Workflow Orchestration
 * 
 * This module provides capabilities for dynamic workflow orchestration,
 * allowing workflows to adapt and evolve based on planning and execution needs.
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import { createTaskManager, TaskManager, TaskStatus, TaskPriority } from './task-management';
import { supabase } from '@/lib/supabase';

// Workflow planning stages
export enum PlanningStage {
  INITIAL = 'initial',
  REQUIREMENTS_ANALYSIS = 'requirements_analysis',
  TASK_DECOMPOSITION = 'task_decomposition',
  STRATEGY_FORMULATION = 'strategy_formulation',
  RESOURCE_ALLOCATION = 'resource_allocation',
  READY = 'ready'
}

// Strategy types for different search scenarios
export enum SearchStrategy {
  STANDARD = 'standard',           // Basic multi-provider search
  DEEP_RESEARCH = 'deep_research', // In-depth information gathering
  TECHNICAL = 'technical',         // Technical documentation focus
  RECENT_EVENTS = 'recent_events', // Prioritizing recent sources
  ACADEMIC = 'academic',           // Academic/scholarly focus
  BALANCED = 'balanced'            // Balanced approach
}

// Planning result schema
export const PlanningResultSchema = z.object({
  enhancedQuery: z.string(),
  searchStrategy: z.enum([
    SearchStrategy.STANDARD,
    SearchStrategy.DEEP_RESEARCH,
    SearchStrategy.TECHNICAL,
    SearchStrategy.RECENT_EVENTS,
    SearchStrategy.ACADEMIC,
    SearchStrategy.BALANCED
  ]),
  subQueries: z.array(z.string()).optional(),
  expectedSources: z.array(z.string()).optional(),
  resourceAllocation: z.record(z.string(), z.number()).optional(),
  prioritizedDomains: z.array(z.string()).optional(),
  requiredTools: z.array(z.string()).optional(),
  estimatedComplexity: z.enum(['low', 'medium', 'high', 'very_high']).optional(),
  requiresHumanReview: z.boolean().optional(),
  planningNotes: z.string().optional()
});

// Planning result type
export type PlanningResult = z.infer<typeof PlanningResultSchema>;

// Orchestration events
export enum OrchestrationEventType {
  PLANNING_STARTED = 'planning_started',
  PLANNING_STAGE_CHANGED = 'planning_stage_changed',
  PLANNING_COMPLETED = 'planning_completed',
  WORKFLOW_ADAPTING = 'workflow_adapting',
  WORKFLOW_ADAPTED = 'workflow_adapted',
  RESOURCE_ALLOCATED = 'resource_allocated',
  STRATEGY_SELECTED = 'strategy_selected'
}

/**
 * Workflow Orchestrator
 * 
 * Dynamically orchestrates workflows based on planning
 * and execution requirements.
 */
export class WorkflowOrchestrator {
  private emitter: EventEmitter;
  private taskManager: TaskManager;
  private searchId: string;
  private userId: string;
  private planningStage: PlanningStage = PlanningStage.INITIAL;
  private planningResult: Partial<PlanningResult> = {};
  private currentStrategy: SearchStrategy = SearchStrategy.STANDARD;
  private isInitialized = false;

  /**
   * Create a new WorkflowOrchestrator
   * @param searchId The search ID
   * @param userId The user ID
   * @param emitter Optional event emitter
   */
  constructor(searchId: string, userId: string, emitter?: EventEmitter) {
    this.searchId = searchId;
    this.userId = userId;
    this.emitter = emitter || new EventEmitter();
    this.taskManager = createTaskManager(searchId, userId, this.emitter);
  }

  /**
   * Initialize the orchestrator
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Initialize task manager
    await this.taskManager.initialize();
    
    // Load existing planning data if available
    await this.loadPlanningData();
    
    this.isInitialized = true;
  }

  /**
   * Load planning data from database
   */
  private async loadPlanningData(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('workflow_planning')
        .select('*')
        .eq('searchId', this.searchId)
        .eq('userId', this.userId)
        .single();
      
      if (error) {
        if (error.code !== 'PGRST116') { // No data found
          console.error('[WorkflowOrchestrator] Error loading planning data:', error);
        }
        return;
      }
      
      if (data) {
        this.planningStage = data.planning_stage as PlanningStage;
        this.planningResult = data.planning_result as Partial<PlanningResult>;
        this.currentStrategy = (data.planning_result?.searchStrategy as SearchStrategy) || SearchStrategy.STANDARD;
      }
    } catch (error) {
      console.error('[WorkflowOrchestrator] Error loading planning data:', error);
    }
  }

  /**
   * Save planning data to database
   */
  private async savePlanningData(): Promise<void> {
    try {
      const planningData = {
        searchId: this.searchId,
        userId: this.userId,
        planning_stage: this.planningStage,
        planning_result: this.planningResult,
        updated_at: new Date().toISOString()
      };
      
      // Check if record exists
      const { data, error: fetchError } = await supabase
        .from('workflow_planning')
        .select('id')
        .eq('searchId', this.searchId)
        .eq('userId', this.userId)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('[WorkflowOrchestrator] Error checking planning data:', fetchError);
        return;
      }
      
      if (data) {
        // Update existing record
        const { error } = await supabase
          .from('workflow_planning')
          .update(planningData)
          .eq('id', data.id);
          
        if (error) {
          console.error('[WorkflowOrchestrator] Error updating planning data:', error);
        }
      } else {
        // Insert new record
        const { error } = await supabase
          .from('workflow_planning')
          .insert({
            ...planningData,
            created_at: new Date().toISOString()
          });
          
        if (error) {
          console.error('[WorkflowOrchestrator] Error inserting planning data:', error);
        }
      }
    } catch (error) {
      console.error('[WorkflowOrchestrator] Error saving planning data:', error);
    }
  }

  /**
   * Start the planning process
   * @param query The original search query
   */
  async startPlanning(query: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Reset planning state
    this.planningStage = PlanningStage.INITIAL;
    this.planningResult = {};
    
    // Emit planning started event
    this.emitEvent(OrchestrationEventType.PLANNING_STARTED, {
      searchId: this.searchId,
      query,
      timestamp: new Date().toISOString()
    });
    
    // Create initial planning tasks
    await this.taskManager.createTask({
      searchId: this.searchId,
      userId: this.userId,
      title: 'Analyze query requirements',
      description: `Analyze the requirements for query: "${query}"`,
      priority: TaskPriority.HIGH,
      tags: ['planning', 'requirements']
    });
    
    await this.taskManager.createTask({
      searchId: this.searchId,
      userId: this.userId,
      title: 'Decompose query into subtasks',
      description: `Break down query into manageable search subtasks: "${query}"`,
      priority: TaskPriority.HIGH,
      tags: ['planning', 'decomposition']
    });
    
    await this.taskManager.createTask({
      searchId: this.searchId,
      userId: this.userId,
      title: 'Formulate search strategy',
      description: `Determine optimal search strategy for: "${query}"`,
      priority: TaskPriority.HIGH,
      tags: ['planning', 'strategy']
    });
    
    // Progress to requirements analysis stage
    await this.setStage(PlanningStage.REQUIREMENTS_ANALYSIS);
  }

  /**
   * Set the planning stage
   * @param stage The new planning stage
   */
  async setStage(stage: PlanningStage): Promise<void> {
    const previousStage = this.planningStage;
    this.planningStage = stage;
    
    // Emit stage changed event
    this.emitEvent(OrchestrationEventType.PLANNING_STAGE_CHANGED, {
      searchId: this.searchId,
      previousStage,
      currentStage: stage,
      timestamp: new Date().toISOString()
    });
    
    // Save planning data
    await this.savePlanningData();
  }

  /**
   * Update the planning result with new information
   * @param update Fields to update in the planning result
   */
  async updatePlanningResult(update: Partial<PlanningResult>): Promise<void> {
    // Merge updates with existing result
    this.planningResult = {
      ...this.planningResult,
      ...update
    };
    
    // If search strategy was updated, emit event
    if (update.searchStrategy && update.searchStrategy !== this.currentStrategy) {
      this.currentStrategy = update.searchStrategy;
      
      this.emitEvent(OrchestrationEventType.STRATEGY_SELECTED, {
        searchId: this.searchId,
        strategy: this.currentStrategy,
        timestamp: new Date().toISOString()
      });
    }
    
    // Save planning data
    await this.savePlanningData();
  }

  /**
   * Complete the planning process and get the result
   */
  async completePlanning(): Promise<PlanningResult> {
    // Validate planning result
    try {
      const validResult = PlanningResultSchema.parse(this.planningResult);
      
      // Set planning stage to ready
      await this.setStage(PlanningStage.READY);
      
      // Emit planning completed event
      this.emitEvent(OrchestrationEventType.PLANNING_COMPLETED, {
        searchId: this.searchId,
        planningResult: validResult,
        timestamp: new Date().toISOString()
      });
      
      return validResult;
    } catch (error) {
      console.error('[WorkflowOrchestrator] Invalid planning result:', error);
      throw new Error('Planning result is incomplete or invalid');
    }
  }

  /**
   * Get the workflow for the current search strategy
   * @returns Object with configured workflow steps
   */
  getWorkflowForStrategy(): any {
    // Determine workflow configuration based on strategy
    const strategyConfigs = {
      [SearchStrategy.STANDARD]: {
        steps: ['planning-query-enhancement', 'exa-search', 'jina-search', 'aggregate-deduplicate', 'rag'],
        parallelSteps: ['exa-search', 'jina-search'],
        includeHumanReview: false
      },
      [SearchStrategy.DEEP_RESEARCH]: {
        steps: ['planning-query-enhancement', 'exa-search', 'jina-search', 'deep-search', 'scrape-webpage', 'aggregate-deduplicate', 'human-review', 'rag'],
        parallelSteps: ['exa-search', 'jina-search', 'deep-search'],
        includeHumanReview: true
      },
      [SearchStrategy.TECHNICAL]: {
        steps: ['planning-query-enhancement', 'exa-search', 'jina-search', 'deep-search', 'code-execution', 'aggregate-deduplicate', 'rag'],
        parallelSteps: ['exa-search', 'jina-search'],
        includeHumanReview: false
      },
      [SearchStrategy.RECENT_EVENTS]: {
        steps: ['planning-query-enhancement', 'exa-search', 'jina-search', 'scrape-webpage', 'aggregate-deduplicate', 'rag'],
        parallelSteps: ['exa-search', 'jina-search'],
        includeHumanReview: false,
        timeConstraints: { recency: 'week' }
      },
      [SearchStrategy.ACADEMIC]: {
        steps: ['planning-query-enhancement', 'exa-search', 'jina-search', 'deep-search', 'aggregate-deduplicate', 'human-review', 'rag'],
        parallelSteps: ['exa-search', 'jina-search', 'deep-search'],
        includeHumanReview: true,
        domainFilters: ['.edu', '.gov', '.org']
      },
      [SearchStrategy.BALANCED]: {
        steps: ['planning-query-enhancement', 'exa-search', 'jina-search', 'aggregate-deduplicate', 'human-review', 'rag'],
        parallelSteps: ['exa-search', 'jina-search'],
        includeHumanReview: true
      }
    };
    
    // Get configuration for current strategy
    const config = strategyConfigs[this.currentStrategy] || strategyConfigs[SearchStrategy.STANDARD];
    
    // Apply any custom overrides from planning result
    if (this.planningResult.requiresHumanReview !== undefined) {
      config.includeHumanReview = this.planningResult.requiresHumanReview;
      
      // Add or remove human-review step as needed
      if (config.includeHumanReview && !config.steps.includes('human-review')) {
        // Add before RAG step
        const ragIndex = config.steps.indexOf('rag');
        if (ragIndex > 0) {
          config.steps.splice(ragIndex, 0, 'human-review');
        } else {
          config.steps.push('human-review');
        }
      } else if (!config.includeHumanReview && config.steps.includes('human-review')) {
        config.steps = config.steps.filter(step => step !== 'human-review');
      }
    }
    
    return config;
  }

  /**
   * Adapt the workflow based on new information or requirements
   * @param adaptationReason Reason for adaptation
   * @param newStrategy Optional new strategy to adopt
   */
  async adaptWorkflow(adaptationReason: string, newStrategy?: SearchStrategy): Promise<any> {
    // Emit workflow adapting event
    this.emitEvent(OrchestrationEventType.WORKFLOW_ADAPTING, {
      searchId: this.searchId,
      currentStrategy: this.currentStrategy,
      adaptationReason,
      timestamp: new Date().toISOString()
    });
    
    // Update strategy if provided
    if (newStrategy) {
      await this.updatePlanningResult({ searchStrategy: newStrategy });
    }
    
    // Get adapted workflow configuration
    const adaptedConfig = this.getWorkflowForStrategy();
    
    // Emit workflow adapted event
    this.emitEvent(OrchestrationEventType.WORKFLOW_ADAPTED, {
      searchId: this.searchId,
      newStrategy: this.currentStrategy,
      adaptedConfig,
      timestamp: new Date().toISOString()
    });
    
    return adaptedConfig;
  }

  /**
   * Get the task manager instance
   */
  getTaskManager(): TaskManager {
    return this.taskManager;
  }

  /**
   * Get the current planning stage
   */
  getCurrentStage(): PlanningStage {
    return this.planningStage;
  }

  /**
   * Get the current planning result
   */
  getPlanningResult(): Partial<PlanningResult> {
    return { ...this.planningResult };
  }

  /**
   * Get the current search strategy
   */
  getCurrentStrategy(): SearchStrategy {
    return this.currentStrategy;
  }

  /**
   * Emit an orchestration event
   * @param eventType Type of event to emit
   * @param payload Event payload
   */
  private emitEvent(eventType: OrchestrationEventType, payload: any): void {
    this.emitter.emit(eventType, {
      type: eventType,
      timestamp: new Date().toISOString(),
      ...payload
    });
  }

  /**
   * Subscribe to orchestration events
   * @param eventType Type of event to subscribe to
   * @param handler Event handler function
   * @returns Function to unsubscribe
   */
  subscribeToEvent(eventType: OrchestrationEventType, handler: (event: any) => void): () => void {
    this.emitter.on(eventType, handler);
    return () => this.emitter.off(eventType, handler);
  }

  /**
   * Subscribe to all orchestration events
   * @param handler Event handler function
   * @returns Function to unsubscribe
   */
  subscribeToAllEvents(handler: (event: any) => void): () => void {
    const eventTypes = Object.values(OrchestrationEventType);
    
    // Subscribe to all event types
    eventTypes.forEach(type => {
      this.emitter.on(type, handler);
    });
    
    // Return unsubscribe function
    return () => {
      eventTypes.forEach(type => {
        this.emitter.off(type, handler);
      });
    };
  }
}

/**
 * Create a workflow orchestrator
 * @param searchId Search ID
 * @param userId User ID
 * @param emitter Optional event emitter
 * @returns WorkflowOrchestrator instance
 */
export function createWorkflowOrchestrator(
  searchId: string,
  userId: string,
  emitter?: EventEmitter
): WorkflowOrchestrator {
  return new WorkflowOrchestrator(searchId, userId, emitter);
}

export default createWorkflowOrchestrator;