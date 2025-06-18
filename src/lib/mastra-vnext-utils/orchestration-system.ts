/**
 * Unified Orchestration System
 * 
 * This module combines task management, workflow orchestration, and planning search
 * capabilities into a unified system that powers Project Gargantua's advanced
 * search workflows.
 */

import { EventEmitter } from 'events';
import { createTaskManager, TaskManager, TaskStatus, TaskPriority } from './task-management';
import { createWorkflowOrchestrator, WorkflowOrchestrator, SearchStrategy, PlanningStage } from './dynamic-orchestration';
import { createPlanningSearchManager, PlanningSearchManager, PlanningQueryType, InsightType } from './planning-search';
import { supabase } from '@/lib/supabase';
import { EventStreamWriter } from './stream-events';

// Search providers configuration
export interface SearchProviderConfig {
  name: string;
  provider: any;
  enabled: boolean;
}

// Agent configuration
export interface AgentConfig {
  id: string;
  model: string;
  description: string;
  provider: string;
  enabled: boolean;
  tools: string[];
}

// Orchestration system events
export enum OrchestrationSystemEventType {
  SYSTEM_INITIALIZED = 'system_initialized',
  SEARCH_STARTED = 'search_started',
  SEARCH_COMPLETED = 'search_completed',
  SEARCH_FAILED = 'search_failed',
  PLANNING_PHASE_STARTED = 'planning_phase_started',
  PLANNING_PHASE_COMPLETED = 'planning_phase_completed',
  EXECUTION_PHASE_STARTED = 'execution_phase_started',
  EXECUTION_PHASE_COMPLETED = 'execution_phase_completed',
  HUMAN_FEEDBACK_REQUIRED = 'human_feedback_required',
  HUMAN_FEEDBACK_RECEIVED = 'human_feedback_received',
  TASK_CREATED = 'task_created',
  TASK_COMPLETED = 'task_completed',
  WORKFLOW_ADAPTED = 'workflow_adapted'
}

/**
 * Unified Orchestration System
 * 
 * Central orchestration system that unifies task management,
 * workflow orchestration, and planning search capabilities.
 */
export class OrchestrationSystem {
  private emitter: EventEmitter;
  private searchId: string;
  private userId: string;
  private originalQuery: string;
  private taskManager: TaskManager;
  private workflowOrchestrator: WorkflowOrchestrator;
  private planningSearchManager: PlanningSearchManager;
  private searchProviders: Map<string, any> = new Map();
  private agents: Map<string, any> = new Map();
  private isInitialized = false;
  private streamWriter: EventStreamWriter;
  
  /**
   * Create a new orchestration system
   * @param searchId Search ID
   * @param userId User ID
   * @param query Original query
   * @param emitter Optional event emitter
   */
  constructor(
    searchId: string,
    userId: string,
    query: string,
    emitter?: EventEmitter
  ) {
    this.searchId = searchId;
    this.userId = userId;
    this.originalQuery = query;
    this.emitter = emitter || new EventEmitter();
    
    // Create component systems
    this.taskManager = createTaskManager(searchId, userId, this.emitter);
    this.workflowOrchestrator = createWorkflowOrchestrator(searchId, userId, this.emitter);
    this.planningSearchManager = createPlanningSearchManager(
      searchId,
      userId,
      this.taskManager,
      this.emitter
    );
    
    // Create event stream writer
    this.streamWriter = new EventStreamWriter(searchId);
    
    // Connect events between components
    this.setupEventConnections();
  }
  
  /**
   * Initialize the orchestration system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // Initialize components
    await this.taskManager.initialize();
    await this.workflowOrchestrator.initialize();
    
    // Register providers with planning search manager
    for (const [name, provider] of this.searchProviders.entries()) {
      this.planningSearchManager.registerSearchProvider(name, provider);
    }
    
    this.isInitialized = true;
    
    // Emit system initialized event
    this.emitEvent(OrchestrationSystemEventType.SYSTEM_INITIALIZED, {
      searchId: this.searchId,
      userId: this.userId,
      query: this.originalQuery,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Register a search provider
   * @param config Provider configuration
   */
  registerSearchProvider(config: SearchProviderConfig): void {
    if (config.enabled) {
      this.searchProviders.set(config.name, config.provider);
      
      // Register with planning search manager if initialized
      if (this.isInitialized) {
        this.planningSearchManager.registerSearchProvider(config.name, config.provider);
      }
    }
  }
  
  /**
   * Register an agent
   * @param config Agent configuration
   */
  registerAgent(config: AgentConfig): void {
    if (config.enabled) {
      this.agents.set(config.id, config);
    }
  }
  
  /**
   * Get a registered agent
   * @param id Agent ID
   * @returns Agent configuration or undefined
   */
  getAgent(id: string): AgentConfig | undefined {
    return this.agents.get(id);
  }
  
  /**
   * Setup event connections between components
   */
  private setupEventConnections(): void {
    // Connect task events to system events
    this.taskManager.subscribeToEvent('task_created', (event) => {
      this.emitEvent(OrchestrationSystemEventType.TASK_CREATED, event);
    });
    
    this.taskManager.subscribeToEvent('task_completed', (event) => {
      this.emitEvent(OrchestrationSystemEventType.TASK_COMPLETED, event);
    });
    
    // Connect workflow orchestrator events
    this.workflowOrchestrator.subscribeToEvent('workflow_adapted', (event) => {
      this.emitEvent(OrchestrationSystemEventType.WORKFLOW_ADAPTED, event);
    });
    
    // Connect planning search events
    this.planningSearchManager.subscribeToEvent('planning_insight_discovered', (event) => {
      // Forward important insights to the stream writer
      this.streamWriter.sendCustomUpdate(1, 'planning_insight', {
        insightType: event.insightType,
        content: event.content,
        timestamp: event.timestamp
      });
    });
    
    this.planningSearchManager.subscribeToEvent('planning_search_strategy_recommended', (event) => {
      // Forward strategy recommendations to the stream writer
      this.streamWriter.sendCustomUpdate(1, 'strategy_recommendation', {
        strategy: event.strategy,
        score: event.score,
        timestamp: event.timestamp
      });
    });
  }
  
  /**
   * Start the search process
   */
  async startSearch(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Emit search started event
    this.emitEvent(OrchestrationSystemEventType.SEARCH_STARTED, {
      searchId: this.searchId,
      userId: this.userId,
      query: this.originalQuery,
      timestamp: new Date().toISOString()
    });
    
    // Send search started event to client
    await this.streamWriter.sendWorkflowStarted(this.searchId);
    
    try {
      // Start planning phase
      await this.startPlanningPhase();
      
      // Start execution phase
      await this.startExecutionPhase();
      
      // Emit search completed event
      this.emitEvent(OrchestrationSystemEventType.SEARCH_COMPLETED, {
        searchId: this.searchId,
        timestamp: new Date().toISOString()
      });
      
      // Send search completed event to client
      await this.streamWriter.sendWorkflowCompleted(this.searchId);
    } catch (error) {
      console.error('[OrchestrationSystem] Search error:', error);
      
      // Emit search failed event
      this.emitEvent(OrchestrationSystemEventType.SEARCH_FAILED, {
        searchId: this.searchId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
      
      // Send search failed event to client
      await this.streamWriter.sendWorkflowFailed(
        'Search failed',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
  
  /**
   * Start the planning phase
   */
  private async startPlanningPhase(): Promise<void> {
    // Emit planning phase started event
    this.emitEvent(OrchestrationSystemEventType.PLANNING_PHASE_STARTED, {
      searchId: this.searchId,
      query: this.originalQuery,
      timestamp: new Date().toISOString()
    });
    
    // Send planning phase started event to client
    await this.streamWriter.sendManualUpdate(1, 'planning_phase_started', {
      query: this.originalQuery,
      searchId: this.searchId,
      timestamp: new Date().toISOString()
    });
    
    // Start planning process
    await this.workflowOrchestrator.startPlanning(this.originalQuery);
    
    // Perform domain exploration
    await this.performPlanningResearch();
    
    // Set planning stage to task decomposition
    await this.workflowOrchestrator.setStage(PlanningStage.TASK_DECOMPOSITION);
    
    // Update planning result with insights
    const recommendedStrategy = this.planningSearchManager.getRecommendedStrategy();
    await this.workflowOrchestrator.updatePlanningResult({
      searchStrategy: recommendedStrategy,
      enhancedQuery: this.originalQuery
    });
    
    // Set planning stage to strategy formulation
    await this.workflowOrchestrator.setStage(PlanningStage.STRATEGY_FORMULATION);
    
    // Complete planning process
    const planningResult = await this.workflowOrchestrator.completePlanning();
    
    // Emit planning phase completed event
    this.emitEvent(OrchestrationSystemEventType.PLANNING_PHASE_COMPLETED, {
      searchId: this.searchId,
      planningResult,
      timestamp: new Date().toISOString()
    });
    
    // Send planning phase completed event to client
    await this.streamWriter.sendManualUpdate(1, 'planning_phase_completed', {
      strategy: planningResult.searchStrategy,
      enhancedQuery: planningResult.enhancedQuery,
      searchId: this.searchId,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Perform planning research to inform strategy
   */
  private async performPlanningResearch(): Promise<void> {
    // Perform domain exploration
    await this.planningSearchManager.search(
      this.originalQuery,
      PlanningQueryType.DOMAIN_EXPLORATION
    );
    
    // Perform term definition search
    await this.planningSearchManager.search(
      this.originalQuery,
      PlanningQueryType.TERM_DEFINITION
    );
    
    // Perform strategy research
    await this.planningSearchManager.search(
      this.originalQuery,
      PlanningQueryType.STRATEGY_RESEARCH
    );
    
    // Perform time sensitivity check
    await this.planningSearchManager.search(
      this.originalQuery,
      PlanningQueryType.TIME_SENSITIVITY
    );
    
    // Perform complexity assessment
    await this.planningSearchManager.search(
      this.originalQuery,
      PlanningQueryType.COMPLEXITY_ASSESSMENT
    );
  }
  
  /**
   * Start the execution phase
   */
  private async startExecutionPhase(): Promise<void> {
    // Emit execution phase started event
    this.emitEvent(OrchestrationSystemEventType.EXECUTION_PHASE_STARTED, {
      searchId: this.searchId,
      timestamp: new Date().toISOString()
    });
    
    // Send execution phase started event to client
    await this.streamWriter.sendManualUpdate(2, 'execution_phase_started', {
      searchId: this.searchId,
      timestamp: new Date().toISOString()
    });
    
    // Get workflow configuration based on strategy
    const workflowConfig = this.workflowOrchestrator.getWorkflowForStrategy();
    
    // Execute the workflow
    // For now, this is a placeholder - the actual workflow execution
    // would be handled by Mastra vNext or a similar orchestration system
    console.log('[OrchestrationSystem] Workflow configuration:', workflowConfig);
    
    // Check if human review is needed
    if (workflowConfig.includeHumanReview) {
      await this.requestHumanFeedback();
    }
    
    // Emit execution phase completed event
    this.emitEvent(OrchestrationSystemEventType.EXECUTION_PHASE_COMPLETED, {
      searchId: this.searchId,
      timestamp: new Date().toISOString()
    });
    
    // Send execution phase completed event to client
    await this.streamWriter.sendManualUpdate(3, 'execution_phase_completed', {
      searchId: this.searchId,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Request human feedback
   */
  private async requestHumanFeedback(): Promise<void> {
    // Emit human feedback required event
    this.emitEvent(OrchestrationSystemEventType.HUMAN_FEEDBACK_REQUIRED, {
      searchId: this.searchId,
      timestamp: new Date().toISOString()
    });
    
    // Send human feedback required event to client
    await this.streamWriter.sendManualUpdate(2, 'human_feedback_required', {
      searchId: this.searchId,
      timestamp: new Date().toISOString()
    });
    
    // In a real implementation, we would wait for human feedback
    // For now, we'll simulate it with a 1-second delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Emit human feedback received event
    this.emitEvent(OrchestrationSystemEventType.HUMAN_FEEDBACK_RECEIVED, {
      searchId: this.searchId,
      timestamp: new Date().toISOString()
    });
    
    // Send human feedback received event to client
    await this.streamWriter.sendManualUpdate(2, 'human_feedback_received', {
      searchId: this.searchId,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Get the task manager
   * @returns The task manager
   */
  getTaskManager(): TaskManager {
    return this.taskManager;
  }
  
  /**
   * Get the workflow orchestrator
   * @returns The workflow orchestrator
   */
  getWorkflowOrchestrator(): WorkflowOrchestrator {
    return this.workflowOrchestrator;
  }
  
  /**
   * Get the planning search manager
   * @returns The planning search manager
   */
  getPlanningSearchManager(): PlanningSearchManager {
    return this.planningSearchManager;
  }
  
  /**
   * Get the event stream writer
   * @returns The event stream writer
   */
  getStreamWriter(): EventStreamWriter {
    return this.streamWriter;
  }
  
  /**
   * Emit an orchestration system event
   * @param eventType Type of event to emit
   * @param payload Event payload
   */
  private emitEvent(eventType: OrchestrationSystemEventType, payload: any): void {
    this.emitter.emit(eventType, {
      type: eventType,
      timestamp: new Date().toISOString(),
      ...payload
    });
  }
  
  /**
   * Subscribe to orchestration system events
   * @param eventType Type of event to subscribe to
   * @param handler Event handler function
   * @returns Function to unsubscribe
   */
  subscribeToEvent(eventType: OrchestrationSystemEventType, handler: (event: any) => void): () => void {
    this.emitter.on(eventType, handler);
    return () => this.emitter.off(eventType, handler);
  }
  
  /**
   * Subscribe to all orchestration system events
   * @param handler Event handler function
   * @returns Function to unsubscribe
   */
  subscribeToAllEvents(handler: (event: any) => void): () => void {
    const eventTypes = Object.values(OrchestrationSystemEventType);
    
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
 * Create a new orchestration system
 * @param searchId Search ID
 * @param userId User ID
 * @param query Original query
 * @param emitter Optional event emitter
 * @returns OrchestrationSystem instance
 */
export function createOrchestrationSystem(
  searchId: string,
  userId: string,
  query: string,
  emitter?: EventEmitter
): OrchestrationSystem {
  return new OrchestrationSystem(searchId, userId, query, emitter);
}

export default createOrchestrationSystem;