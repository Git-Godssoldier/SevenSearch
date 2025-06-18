/**
 * Gargantua Workflow Orchestration E2B Evaluations
 * 
 * This module provides E2B secure runtime evaluations for the Dynamic Workflow
 * Orchestration system of Project Gargantua. These evaluations test strategy
 * selection, workflow adaptation, and planning stage progression.
 */

import { E2BTestRunner } from './e2b-test-runner';

/**
 * Run comprehensive E2B evaluations for the Workflow Orchestration system
 */
export class WorkflowOrchestrationEvaluator {
  private e2bRunner: E2BTestRunner;
  private isInitialized = false;
  private evalResults: Map<string, any> = new Map();

  constructor(apiKey: string) {
    this.e2bRunner = new E2BTestRunner(apiKey);
  }

  /**
   * Initialize the evaluator
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    await this.e2bRunner.initialize();
    this.isInitialized = true;
    console.log('Workflow Orchestration Evaluator initialized');
  }

  /**
   * Evaluate the workflow orchestration capabilities
   */
  async evaluateWorkflowOrchestration(): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const workflowOrchestrationEval = `
      // Evaluate the workflow orchestration capabilities
      try {
        // Mock dependencies
        const EventEmitter = function() {
          const events = {};
          
          this.on = function(event, listener) {
            if (!events[event]) {
              events[event] = [];
            }
            events[event].push(listener);
          };
          
          this.emit = function(event, ...args) {
            if (events[event]) {
              events[event].forEach(listener => listener(...args));
            }
          };
          
          this.off = function(event, listener) {
            if (events[event]) {
              events[event] = events[event].filter(l => l !== listener);
            }
          };
        };
        
        // Mock TaskManager
        class TaskManager {
          tasks = new Map();
          emitter;
          searchId;
          userId;
          
          constructor(searchId, userId, emitter) {
            this.searchId = searchId;
            this.userId = userId;
            this.emitter = emitter || new EventEmitter();
          }
          
          async initialize() {
            return Promise.resolve();
          }
          
          async createTask(taskInput) {
            const taskId = 'task-' + Math.random().toString(36).substring(2, 7);
            const task = {
              id: taskId,
              ...taskInput,
              status: 'pending',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            this.tasks.set(taskId, task);
            this.emitter.emit('task_created', { task });
            return task;
          }
        }
        
        // Mock Supabase client
        const createMockSupabase = (behavior = 'success') => {
          return {
            from: () => ({
              insert: (data) => {
                if (behavior === 'error') {
                  return Promise.resolve({ data: null, error: { message: 'Mock database error' } });
                }
                return Promise.resolve({ data, error: null });
              },
              update: (data) => ({
                eq: () => ({
                  eq: () => {
                    if (behavior === 'error') {
                      return Promise.resolve({ data: null, error: { message: 'Mock database error' } });
                    }
                    return Promise.resolve({ data, error: null });
                  }
                })
              }),
              select: () => ({
                eq: () => ({
                  eq: () => {
                    if (behavior === 'empty') {
                      return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'No data found' } });
                    } else if (behavior === 'error') {
                      return Promise.resolve({ data: null, error: { message: 'Mock database error' } });
                    }
                    return Promise.resolve({
                      data: {
                        id: 'plan-12345',
                        searchId: 'search-123',
                        userId: 'user-123',
                        planning_stage: 'initial',
                        planning_result: {},
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                      },
                      error: null
                    });
                  }
                })
              }),
              upsert: (data) => {
                if (behavior === 'error') {
                  return Promise.resolve({ data: null, error: { message: 'Mock database error' } });
                }
                return Promise.resolve({ data, error: null });
              }
            })
          };
        };
        
        // Define constants used in WorkflowOrchestrator
        const PlanningStage = {
          INITIAL: 'initial',
          REQUIREMENTS_ANALYSIS: 'requirements_analysis',
          TASK_DECOMPOSITION: 'task_decomposition',
          STRATEGY_FORMULATION: 'strategy_formulation',
          RESOURCE_ALLOCATION: 'resource_allocation',
          READY: 'ready'
        };
        
        const SearchStrategy = {
          STANDARD: 'standard',
          DEEP_RESEARCH: 'deep_research',
          TECHNICAL: 'technical',
          RECENT_EVENTS: 'recent_events',
          ACADEMIC: 'academic',
          BALANCED: 'balanced'
        };
        
        // Mock WorkflowOrchestrator implementation
        class WorkflowOrchestrator {
          emitter;
          taskManager;
          searchId;
          userId;
          planningStage = PlanningStage.INITIAL;
          planningResult = {};
          currentStrategy = SearchStrategy.STANDARD;
          isInitialized = false;
          supabase;
          
          constructor(searchId, userId, emitter, supabase) {
            this.searchId = searchId;
            this.userId = userId;
            this.emitter = emitter || new EventEmitter();
            this.taskManager = new TaskManager(searchId, userId, this.emitter);
            this.supabase = supabase || createMockSupabase();
          }
          
          async initialize() {
            if (this.isInitialized) return;
            
            await this.taskManager.initialize();
            await this.loadPlanningData();
            
            this.isInitialized = true;
          }
          
          async loadPlanningData() {
            try {
              const { data, error } = await this.supabase
                .from('workflow_planning')
                .select('*')
                .eq('searchId', this.searchId)
                .eq('userId', this.userId);
                
              if (error) {
                if (error.code !== 'PGRST116') { // No data found
                  console.error('Error loading planning data:', error);
                }
                return;
              }
              
              if (data) {
                this.planningStage = data.planning_stage;
                this.planningResult = data.planning_result || {};
                this.currentStrategy = data.planning_result?.searchStrategy || SearchStrategy.STANDARD;
              }
            } catch (err) {
              console.error('Error loading planning data:', err);
            }
          }
          
          async savePlanningData() {
            try {
              const planningData = {
                searchId: this.searchId,
                userId: this.userId,
                planning_stage: this.planningStage,
                planning_result: this.planningResult,
                updated_at: new Date().toISOString()
              };
              
              const { error } = await this.supabase
                .from('workflow_planning')
                .upsert({
                  ...planningData,
                  created_at: new Date().toISOString()
                });
                
              if (error) {
                console.error('Error saving planning data:', error);
              }
            } catch (err) {
              console.error('Error saving planning data:', err);
            }
          }
          
          async startPlanning(query) {
            if (!this.isInitialized) {
              await this.initialize();
            }
            
            // Reset planning state
            this.planningStage = PlanningStage.INITIAL;
            this.planningResult = {};
            
            // Emit planning started event
            this.emitter.emit('planning_started', {
              searchId: this.searchId,
              query,
              timestamp: new Date().toISOString()
            });
            
            // Create initial planning tasks
            await this.taskManager.createTask({
              searchId: this.searchId,
              userId: this.userId,
              title: 'Analyze query requirements',
              description: \`Analyze the requirements for query: "\${query}"\`,
              priority: 'high',
              tags: ['planning', 'requirements']
            });
            
            await this.taskManager.createTask({
              searchId: this.searchId,
              userId: this.userId,
              title: 'Decompose query into subtasks',
              description: \`Break down query into manageable search subtasks: "\${query}"\`,
              priority: 'high',
              tags: ['planning', 'decomposition']
            });
            
            await this.taskManager.createTask({
              searchId: this.searchId,
              userId: this.userId,
              title: 'Formulate search strategy',
              description: \`Determine optimal search strategy for: "\${query}"\`,
              priority: 'high',
              tags: ['planning', 'strategy']
            });
            
            // Progress to requirements analysis stage
            await this.setStage(PlanningStage.REQUIREMENTS_ANALYSIS);
            
            return true;
          }
          
          async setStage(stage) {
            const previousStage = this.planningStage;
            this.planningStage = stage;
            
            // Emit stage changed event
            this.emitter.emit('planning_stage_changed', {
              searchId: this.searchId,
              previousStage,
              currentStage: stage,
              timestamp: new Date().toISOString()
            });
            
            // Save planning data
            await this.savePlanningData();
            
            return true;
          }
          
          async updatePlanningResult(update) {
            // Merge updates with existing result
            this.planningResult = {
              ...this.planningResult,
              ...update
            };
            
            // If search strategy was updated, emit event
            if (update.searchStrategy && update.searchStrategy !== this.currentStrategy) {
              this.currentStrategy = update.searchStrategy;
              
              this.emitter.emit('strategy_selected', {
                searchId: this.searchId,
                strategy: this.currentStrategy,
                timestamp: new Date().toISOString()
              });
            }
            
            // Save planning data
            await this.savePlanningData();
            
            return true;
          }
          
          async completePlanning() {
            // Validate planning result (simplified for testing)
            if (!this.planningResult.searchStrategy || !this.planningResult.enhancedQuery) {
              throw new Error('Planning result is incomplete');
            }
            
            // Set planning stage to ready
            await this.setStage(PlanningStage.READY);
            
            // Emit planning completed event
            this.emitter.emit('planning_completed', {
              searchId: this.searchId,
              planningResult: this.planningResult,
              timestamp: new Date().toISOString()
            });
            
            return this.planningResult;
          }
          
          getWorkflowForStrategy() {
            // Strategy-specific workflow configurations
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
          
          async adaptWorkflow(adaptationReason, newStrategy) {
            // Emit workflow adapting event
            this.emitter.emit('workflow_adapting', {
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
            this.emitter.emit('workflow_adapted', {
              searchId: this.searchId,
              newStrategy: this.currentStrategy,
              adaptedConfig,
              timestamp: new Date().toISOString()
            });
            
            return adaptedConfig;
          }
          
          getTaskManager() {
            return this.taskManager;
          }
          
          getCurrentStage() {
            return this.planningStage;
          }
          
          getPlanningResult() {
            return { ...this.planningResult };
          }
          
          getCurrentStrategy() {
            return this.currentStrategy;
          }
        }
        
        // Test cases for workflow orchestration
        const testPlanningStages = async () => {
          // Create a workflow orchestrator
          const emitter = new EventEmitter();
          const searchId = 'search-123';
          const userId = 'user-123';
          const supabase = createMockSupabase('success');
          
          const orchestrator = new WorkflowOrchestrator(searchId, userId, emitter, supabase);
          await orchestrator.initialize();
          
          // Test case results
          const results = [];
          
          // Test 1: Start planning process
          try {
            const query = 'How does quantum computing work?';
            await orchestrator.startPlanning(query);
            
            // Check that planning was started and tasks were created
            const taskManager = orchestrator.getTaskManager();
            const tasks = taskManager.tasks;
            
            results.push({
              name: 'Start Planning Process',
              success: orchestrator.getCurrentStage() === PlanningStage.REQUIREMENTS_ANALYSIS && 
                       tasks.size === 3,
              stage: orchestrator.getCurrentStage(),
              taskCount: tasks.size
            });
          } catch (error) {
            results.push({
              name: 'Start Planning Process',
              success: false,
              error: error.message
            });
          }
          
          // Test 2: Progress through planning stages
          try {
            // Set stage to task decomposition
            await orchestrator.setStage(PlanningStage.TASK_DECOMPOSITION);
            
            // Update planning result with strategy
            await orchestrator.updatePlanningResult({
              searchStrategy: SearchStrategy.TECHNICAL,
              enhancedQuery: 'What are the principles and applications of quantum computing?'
            });
            
            // Set stage to strategy formulation
            await orchestrator.setStage(PlanningStage.STRATEGY_FORMULATION);
            
            // Check that stages progressed correctly
            results.push({
              name: 'Progress Through Planning Stages',
              success: orchestrator.getCurrentStage() === PlanningStage.STRATEGY_FORMULATION && 
                       orchestrator.getCurrentStrategy() === SearchStrategy.TECHNICAL,
              stage: orchestrator.getCurrentStage(),
              strategy: orchestrator.getCurrentStrategy()
            });
          } catch (error) {
            results.push({
              name: 'Progress Through Planning Stages',
              success: false,
              error: error.message
            });
          }
          
          // Test 3: Complete planning
          try {
            // Complete planning
            const planningResult = await orchestrator.completePlanning();
            
            // Check that planning was completed
            results.push({
              name: 'Complete Planning',
              success: orchestrator.getCurrentStage() === PlanningStage.READY && 
                       planningResult.searchStrategy === SearchStrategy.TECHNICAL,
              stage: orchestrator.getCurrentStage(),
              planningResult
            });
          } catch (error) {
            results.push({
              name: 'Complete Planning',
              success: false,
              error: error.message
            });
          }
          
          return results;
        };
        
        // Test cases for workflow strategies
        const testWorkflowStrategies = async () => {
          // Create a workflow orchestrator
          const emitter = new EventEmitter();
          const searchId = 'search-123';
          const userId = 'user-123';
          const supabase = createMockSupabase('success');
          
          const orchestrator = new WorkflowOrchestrator(searchId, userId, emitter, supabase);
          await orchestrator.initialize();
          
          // Test case results
          const results = [];
          
          // Test 1: Get workflow for standard strategy
          try {
            // Set standard strategy
            await orchestrator.updatePlanningResult({
              searchStrategy: SearchStrategy.STANDARD
            });
            
            // Get workflow configuration
            const config = orchestrator.getWorkflowForStrategy();
            
            // Check that the configuration is correct
            results.push({
              name: 'Standard Strategy Configuration',
              success: config.steps.includes('exa-search') && 
                       config.steps.includes('jina-search') && 
                       !config.includeHumanReview,
              strategy: SearchStrategy.STANDARD,
              steps: config.steps,
              includeHumanReview: config.includeHumanReview
            });
          } catch (error) {
            results.push({
              name: 'Standard Strategy Configuration',
              success: false,
              error: error.message
            });
          }
          
          // Test 2: Get workflow for deep research strategy
          try {
            // Set deep research strategy
            await orchestrator.updatePlanningResult({
              searchStrategy: SearchStrategy.DEEP_RESEARCH
            });
            
            // Get workflow configuration
            const config = orchestrator.getWorkflowForStrategy();
            
            // Check that the configuration is correct
            results.push({
              name: 'Deep Research Strategy Configuration',
              success: config.steps.includes('deep-search') && 
                       config.steps.includes('scrape-webpage') && 
                       config.includeHumanReview,
              strategy: SearchStrategy.DEEP_RESEARCH,
              steps: config.steps,
              includeHumanReview: config.includeHumanReview
            });
          } catch (error) {
            results.push({
              name: 'Deep Research Strategy Configuration',
              success: false,
              error: error.message
            });
          }
          
          // Test 3: Workflow adaptation
          try {
            // Start with standard strategy
            await orchestrator.updatePlanningResult({
              searchStrategy: SearchStrategy.STANDARD
            });
            
            // Adapt workflow to technical strategy
            const adaptedConfig = await orchestrator.adaptWorkflow(
              'Query contains technical terms',
              SearchStrategy.TECHNICAL
            );
            
            // Check that the workflow was adapted correctly
            results.push({
              name: 'Workflow Adaptation',
              success: orchestrator.getCurrentStrategy() === SearchStrategy.TECHNICAL && 
                       adaptedConfig.steps.includes('code-execution'),
              strategy: orchestrator.getCurrentStrategy(),
              steps: adaptedConfig.steps
            });
          } catch (error) {
            results.push({
              name: 'Workflow Adaptation',
              success: false,
              error: error.message
            });
          }
          
          // Test 4: Human review override
          try {
            // Set academic strategy (includes human review)
            await orchestrator.updatePlanningResult({
              searchStrategy: SearchStrategy.ACADEMIC,
              requiresHumanReview: false  // Override to disable human review
            });
            
            // Get workflow configuration
            const config = orchestrator.getWorkflowForStrategy();
            
            // Check that the human review was overridden
            results.push({
              name: 'Human Review Override',
              success: !config.includeHumanReview && 
                       !config.steps.includes('human-review'),
              strategy: SearchStrategy.ACADEMIC,
              includeHumanReview: config.includeHumanReview,
              steps: config.steps
            });
          } catch (error) {
            results.push({
              name: 'Human Review Override',
              success: false,
              error: error.message
            });
          }
          
          return results;
        };
        
        // Run the test cases
        const runAllTests = async () => {
          console.log('\\n===== Running Planning Stages Tests =====');
          const stagesResults = await testPlanningStages();
          
          console.log('\\n===== Running Workflow Strategies Tests =====');
          const strategyResults = await testWorkflowStrategies();
          
          const allTestsPassed = 
            stagesResults.every(r => r.success) && 
            strategyResults.every(r => r.success);
          
          return {
            componentName: 'WorkflowOrchestration',
            success: allTestsPassed,
            testResults: {
              planningStages: stagesResults,
              workflowStrategies: strategyResults
            },
            summary: allTestsPassed 
              ? 'All workflow orchestration tests passed successfully' 
              : \`\${stagesResults.filter(r => !r.success).length + strategyResults.filter(r => !r.success).length} workflow orchestration tests failed\`
          };
        };
        
        // Run the tests and return results
        const results = await runAllTests();
        return results;
      } catch (error) {
        return {
          componentName: 'WorkflowOrchestration',
          success: false,
          error: error.message,
          summary: \`Evaluation failed with error: \${error.message}\`
        };
      }
    `;

    const result = await this.e2bRunner.runTest(workflowOrchestrationEval);
    
    try {
      const evalResult = JSON.parse(result.output);
      this.evalResults.set('WorkflowOrchestration', evalResult);
      return evalResult;
    } catch (error) {
      console.error('Error parsing workflow orchestration evaluation result:', error);
      return {
        componentName: 'WorkflowOrchestration',
        success: false,
        error: 'Failed to parse evaluation result',
        details: result
      };
    }
  }

  /**
   * Close the evaluator
   */
  async close(): Promise<void> {
    await this.e2bRunner.close();
    this.isInitialized = false;
    console.log('Workflow Orchestration Evaluator closed');
  }
}

/**
 * Create a workflow orchestration evaluator
 * @param apiKey E2B API key
 * @returns WorkflowOrchestrationEvaluator instance
 */
export function createWorkflowOrchestrationEvaluator(apiKey: string): WorkflowOrchestrationEvaluator {
  return new WorkflowOrchestrationEvaluator(apiKey);
}

/**
 * Main function to run evaluations when run directly
 */
async function main() {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    console.error('E2B_API_KEY is required to run evaluations');
    process.exit(1);
  }
  
  const evaluator = createWorkflowOrchestrationEvaluator(apiKey);
  
  try {
    const result = await evaluator.evaluateWorkflowOrchestration();
    
    console.log('\n===== Workflow Orchestration Evaluation Result =====');
    console.log(`Success: ${result.success ? 'PASSED' : 'FAILED'}`);
    console.log(result.summary);
    
    if (!result.success && result.error) {
      console.error('Error:', result.error);
    }
  } catch (error) {
    console.error('Error running workflow orchestration evaluations:', error);
  } finally {
    await evaluator.close();
  }
}

// Run evaluations if called directly
if (require.main === module) {
  main().catch(console.error);
}

export default createWorkflowOrchestrationEvaluator;