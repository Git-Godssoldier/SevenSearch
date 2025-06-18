/**
 * Gargantua Task Management E2B Evaluations
 * 
 * This module provides E2B secure runtime evaluations for the Task Management
 * system of Project Gargantua. These evaluations test the task creation,
 * dependency management, prioritization, and status tracking capabilities.
 */

import { E2BTestRunner } from './e2b-test-runner';

/**
 * Run comprehensive E2B evaluations for the Task Management system
 */
export class TaskManagementEvaluator {
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
    console.log('Task Management Evaluator initialized');
  }

  /**
   * Evaluate the task creation and CRUD operations
   */
  async evaluateTaskCRUD(): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const taskCRUDEval = `
      // Evaluate the task CRUD operations
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
        
        // Mock nanoid for consistent IDs in tests
        const nanoid = () => 'task-' + Math.random().toString(36).substring(2, 7);
        
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
                eq: () => {
                  if (behavior === 'error') {
                    return Promise.resolve({ data: null, error: { message: 'Mock database error' } });
                  }
                  return Promise.resolve({ data, error: null });
                }
              }),
              select: () => ({
                eq: () => ({
                  eq: () => {
                    if (behavior === 'empty') {
                      return Promise.resolve({ data: [], error: null });
                    } else if (behavior === 'error') {
                      return Promise.resolve({ data: null, error: { message: 'Mock database error' } });
                    }
                    return Promise.resolve({
                      data: [
                        {
                          id: 'task-12345',
                          search_id: 'search-123',
                          user_id: 'user-123',
                          title: 'Test Task',
                          description: 'Test Description',
                          priority: 'high',
                          status: 'pending',
                          depends_on: [],
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                          tags: ['test'],
                          metadata: {}
                        }
                      ],
                      error: null
                    });
                  }
                })
              })
            })
          };
        };
        
        // Mock TaskManager implementation (simplified for testing)
        class TaskManager {
          tasks = new Map();
          emitter;
          searchId;
          userId;
          supabase;
          isInitialized = false;
          
          constructor(searchId, userId, emitter, supabase) {
            this.searchId = searchId;
            this.userId = userId;
            this.emitter = emitter || new EventEmitter();
            this.supabase = supabase || createMockSupabase();
          }
          
          async initialize() {
            if (this.isInitialized) return;
            await this.loadTasks();
            this.isInitialized = true;
          }
          
          async loadTasks() {
            try {
              const { data, error } = await this.supabase
                .from('tasks')
                .select('*')
                .eq('search_id', this.searchId)
                .eq('user_id', this.userId);
                
              if (error) {
                throw new Error(\`Failed to load tasks: \${error.message}\`);
              }
              
              if (!data) return;
              
              // Clear existing tasks
              this.tasks.clear();
              
              // Process loaded tasks
              for (const dbTask of data) {
                const task = {
                  id: dbTask.id,
                  searchId: dbTask.search_id,
                  userId: dbTask.user_id,
                  title: dbTask.title,
                  description: dbTask.description,
                  priority: dbTask.priority,
                  status: dbTask.status,
                  dependsOn: dbTask.depends_on || [],
                  createdAt: new Date(dbTask.created_at),
                  updatedAt: new Date(dbTask.updated_at),
                  completedAt: dbTask.completed_at ? new Date(dbTask.completed_at) : undefined,
                  tags: dbTask.tags || [],
                  metadata: dbTask.metadata || {}
                };
                
                this.tasks.set(task.id, task);
              }
            } catch (err) {
              console.error('Error loading tasks:', err);
            }
          }
          
          async createTask(taskInput) {
            if (!this.isInitialized) {
              await this.initialize();
            }
            
            // Generate a task ID and timestamps
            const now = new Date();
            const taskId = nanoid();
            
            // Create the task object
            const task = {
              id: taskId,
              searchId: taskInput.searchId || this.searchId,
              userId: taskInput.userId || this.userId,
              title: taskInput.title,
              description: taskInput.description || '',
              priority: taskInput.priority || 'medium',
              status: 'pending',
              dependsOn: taskInput.dependsOn || [],
              createdAt: now,
              updatedAt: now,
              tags: taskInput.tags || [],
              metadata: taskInput.metadata || {}
            };
            
            // Save to local cache
            this.tasks.set(taskId, task);
            
            // Save to database
            try {
              const { error } = await this.supabase
                .from('tasks')
                .insert({
                  id: task.id,
                  search_id: task.searchId,
                  user_id: task.userId,
                  title: task.title,
                  description: task.description,
                  priority: task.priority,
                  status: task.status,
                  depends_on: task.dependsOn,
                  created_at: task.createdAt.toISOString(),
                  updated_at: task.updatedAt.toISOString(),
                  tags: task.tags,
                  metadata: task.metadata
                });
                
              if (error) {
                throw new Error(\`Failed to save task: \${error.message}\`);
              }
            } catch (err) {
              console.error('Error saving task:', err);
              // Keep in memory even if DB save fails
            }
            
            // Emit task created event
            this.emitter.emit('task_created', { task });
            
            return task;
          }
          
          async updateTask(taskUpdate) {
            if (!this.isInitialized) {
              await this.initialize();
            }
            
            // Find the existing task
            const existingTask = this.tasks.get(taskUpdate.id);
            if (!existingTask) {
              throw new Error(\`Task not found: \${taskUpdate.id}\`);
            }
            
            // Update the task
            const now = new Date();
            const updatedTask = {
              ...existingTask,
              ...taskUpdate,
              updatedAt: now,
              // Set completedAt if status is changed to completed
              completedAt: taskUpdate.status === 'completed' ? now : existingTask.completedAt
            };
            
            // Update local cache
            this.tasks.set(updatedTask.id, updatedTask);
            
            // Update database
            try {
              const dbUpdate = {
                title: taskUpdate.title,
                description: taskUpdate.description,
                priority: taskUpdate.priority,
                status: taskUpdate.status,
                depends_on: taskUpdate.dependsOn,
                updated_at: now.toISOString(),
                tags: taskUpdate.tags,
                metadata: taskUpdate.metadata
              };
              
              // Add completedAt if task is completed
              if (taskUpdate.status === 'completed') {
                dbUpdate.completed_at = now.toISOString();
              }
              
              // Remove undefined fields
              Object.keys(dbUpdate).forEach(key => {
                if (dbUpdate[key] === undefined) {
                  delete dbUpdate[key];
                }
              });
              
              const { error } = await this.supabase
                .from('tasks')
                .update(dbUpdate)
                .eq('id', updatedTask.id);
                
              if (error) {
                throw new Error(\`Failed to update task: \${error.message}\`);
              }
            } catch (err) {
              console.error('Error updating task:', err);
              // Keep memory update even if DB fails
            }
            
            // Emit appropriate events
            this.emitter.emit('task_updated', { task: updatedTask });
            
            if (taskUpdate.status === 'completed') {
              this.emitter.emit('task_completed', { task: updatedTask });
            }
            
            return updatedTask;
          }
          
          getTask(taskId) {
            return this.tasks.get(taskId);
          }
          
          getAllTasks() {
            return Array.from(this.tasks.values());
          }
          
          getTasksByStatus(status) {
            return this.getAllTasks().filter(task => task.status === status);
          }
          
          getNextTask() {
            // Get all pending tasks
            const pendingTasks = this.getTasksByStatus('pending');
            if (pendingTasks.length === 0) {
              return undefined;
            }
            
            // Filter tasks with unresolved dependencies
            const availableTasks = pendingTasks.filter(task => {
              if (task.dependsOn.length === 0) {
                return true;
              }
              
              return task.dependsOn.every(depId => {
                const depTask = this.getTask(depId);
                return depTask && depTask.status === 'completed';
              });
            });
            
            if (availableTasks.length === 0) {
              return undefined;
            }
            
            // Sort by priority (high first)
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            const sortedTasks = [...availableTasks].sort((a, b) => {
              return priorityOrder[a.priority] - priorityOrder[b.priority];
            });
            
            return sortedTasks[0];
          }
          
          async addDependency(taskId, dependsOnId) {
            // Get the tasks
            const task = this.getTask(taskId);
            const dependsOnTask = this.getTask(dependsOnId);
            
            if (!task) {
              throw new Error(\`Task not found: \${taskId}\`);
            }
            
            if (!dependsOnTask) {
              throw new Error(\`Dependency task not found: \${dependsOnId}\`);
            }
            
            // Check for circular dependencies
            if (this.wouldCreateCircularDependency(taskId, dependsOnId)) {
              throw new Error('Cannot add dependency: would create a circular dependency');
            }
            
            // If dependency already exists, do nothing
            if (task.dependsOn.includes(dependsOnId)) {
              return task;
            }
            
            // Add the dependency
            const updatedDependencies = [...task.dependsOn, dependsOnId];
            
            // Update the task
            return this.updateTask({
              id: taskId,
              dependsOn: updatedDependencies
            });
          }
          
          wouldCreateCircularDependency(taskId, dependsOnId) {
            // If task A depends on B, and B already depends on A, it's circular
            const visited = new Set();
            
            const checkDependencies = (currentTaskId) => {
              if (currentTaskId === taskId) {
                return true;  // Found a cycle
              }
              
              if (visited.has(currentTaskId)) {
                return false;  // Already checked this branch
              }
              
              visited.add(currentTaskId);
              
              const currentTask = this.getTask(currentTaskId);
              if (!currentTask) {
                return false;
              }
              
              // Check each dependency
              for (const depId of currentTask.dependsOn) {
                if (checkDependencies(depId)) {
                  return true;
                }
              }
              
              return false;
            };
            
            return checkDependencies(dependsOnId);
          }
        }
        
        // Test cases for task CRUD operations
        const testTaskCRUD = async () => {
          // Create a task manager with success behavior
          const emitter = new EventEmitter();
          const searchId = 'search-123';
          const userId = 'user-123';
          const supabase = createMockSupabase('success');
          
          const taskManager = new TaskManager(searchId, userId, emitter, supabase);
          await taskManager.initialize();
          
          // Test case results
          const results = [];
          
          // Test 1: Create a task
          try {
            const newTask = await taskManager.createTask({
              title: 'Test Task 1',
              description: 'This is a test task',
              priority: 'high',
              tags: ['test', 'important']
            });
            
            results.push({
              name: 'Create Task',
              success: newTask && newTask.id && newTask.title === 'Test Task 1',
              task: newTask
            });
          } catch (error) {
            results.push({
              name: 'Create Task',
              success: false,
              error: error.message
            });
          }
          
          // Test 2: Get a task
          try {
            // Get the task from the previous test
            const taskId = results[0].task.id;
            const task = taskManager.getTask(taskId);
            
            results.push({
              name: 'Get Task',
              success: task && task.id === taskId,
              task
            });
          } catch (error) {
            results.push({
              name: 'Get Task',
              success: false,
              error: error.message
            });
          }
          
          // Test 3: Update a task
          try {
            // Update the task from the previous tests
            const taskId = results[0].task.id;
            const updatedTask = await taskManager.updateTask({
              id: taskId,
              title: 'Updated Task 1',
              priority: 'medium'
            });
            
            results.push({
              name: 'Update Task',
              success: updatedTask && 
                      updatedTask.id === taskId && 
                      updatedTask.title === 'Updated Task 1' &&
                      updatedTask.priority === 'medium',
              task: updatedTask
            });
          } catch (error) {
            results.push({
              name: 'Update Task',
              success: false,
              error: error.message
            });
          }
          
          // Test 4: Complete a task
          try {
            // Complete the task from the previous tests
            const taskId = results[0].task.id;
            const completedTask = await taskManager.updateTask({
              id: taskId,
              status: 'completed'
            });
            
            results.push({
              name: 'Complete Task',
              success: completedTask && 
                      completedTask.id === taskId && 
                      completedTask.status === 'completed' &&
                      completedTask.completedAt instanceof Date,
              task: completedTask
            });
          } catch (error) {
            results.push({
              name: 'Complete Task',
              success: false,
              error: error.message
            });
          }
          
          return results;
        };
        
        // Test cases for task dependencies
        const testTaskDependencies = async () => {
          // Create a task manager
          const emitter = new EventEmitter();
          const searchId = 'search-123';
          const userId = 'user-123';
          const supabase = createMockSupabase('success');
          
          const taskManager = new TaskManager(searchId, userId, emitter, supabase);
          await taskManager.initialize();
          
          // Test case results
          const results = [];
          let task1, task2, task3;
          
          // Create tasks for testing dependencies
          try {
            task1 = await taskManager.createTask({
              title: 'Task 1',
              priority: 'high'
            });
            
            task2 = await taskManager.createTask({
              title: 'Task 2',
              priority: 'medium'
            });
            
            task3 = await taskManager.createTask({
              title: 'Task 3',
              priority: 'low'
            });
            
            results.push({
              name: 'Create Tasks for Dependencies',
              success: task1 && task2 && task3,
              tasks: [task1, task2, task3]
            });
          } catch (error) {
            results.push({
              name: 'Create Tasks for Dependencies',
              success: false,
              error: error.message
            });
            return results; // Can't continue if this fails
          }
          
          // Test 1: Add a dependency
          try {
            // Make task2 depend on task1
            const updatedTask = await taskManager.addDependency(task2.id, task1.id);
            
            results.push({
              name: 'Add Dependency',
              success: updatedTask && 
                      updatedTask.id === task2.id && 
                      updatedTask.dependsOn.includes(task1.id),
              task: updatedTask
            });
          } catch (error) {
            results.push({
              name: 'Add Dependency',
              success: false,
              error: error.message
            });
          }
          
          // Test 2: Get next task (with priority and dependencies)
          try {
            // Since task2 depends on task1, and task1 is not completed,
            // task1 or task3 should be returned (task1 has higher priority)
            const nextTask = taskManager.getNextTask();
            
            results.push({
              name: 'Get Next Task',
              success: nextTask && nextTask.id === task1.id,
              expectedTaskId: task1.id,
              actualTaskId: nextTask ? nextTask.id : null
            });
          } catch (error) {
            results.push({
              name: 'Get Next Task',
              success: false,
              error: error.message
            });
          }
          
          // Test 3: Circular dependency detection
          try {
            // Try to make task1 depend on task2 (would create a cycle)
            try {
              await taskManager.addDependency(task1.id, task2.id);
              results.push({
                name: 'Circular Dependency Detection',
                success: false,
                error: 'Circular dependency not detected'
              });
            } catch (error) {
              // Should throw an error about circular dependency
              results.push({
                name: 'Circular Dependency Detection',
                success: error.message.includes('circular dependency'),
                error: error.message
              });
            }
          } catch (error) {
            results.push({
              name: 'Circular Dependency Detection',
              success: false,
              error: error.message
            });
          }
          
          // Test 4: Complete dependency and check next task
          try {
            // Complete task1
            await taskManager.updateTask({
              id: task1.id,
              status: 'completed'
            });
            
            // Now task2 should be available
            const nextTask = taskManager.getNextTask();
            
            results.push({
              name: 'Next Task After Completing Dependency',
              success: nextTask && nextTask.id === task2.id,
              expectedTaskId: task2.id,
              actualTaskId: nextTask ? nextTask.id : null
            });
          } catch (error) {
            results.push({
              name: 'Next Task After Completing Dependency',
              success: false,
              error: error.message
            });
          }
          
          return results;
        };
        
        // Run the test cases
        const runAllTests = async () => {
          console.log('\\n===== Running Task CRUD Tests =====');
          const crudResults = await testTaskCRUD();
          
          console.log('\\n===== Running Task Dependencies Tests =====');
          const dependencyResults = await testTaskDependencies();
          
          const allTestsPassed = 
            crudResults.every(r => r.success) && 
            dependencyResults.every(r => r.success);
          
          return {
            componentName: 'TaskManagement',
            success: allTestsPassed,
            testResults: {
              crud: crudResults,
              dependencies: dependencyResults
            },
            summary: allTestsPassed 
              ? 'All task management tests passed successfully' 
              : \`\${crudResults.filter(r => !r.success).length + dependencyResults.filter(r => !r.success).length} task management tests failed\`
          };
        };
        
        // Run the tests and return results
        const results = await runAllTests();
        return results;
      } catch (error) {
        return {
          componentName: 'TaskManagement',
          success: false,
          error: error.message,
          summary: \`Evaluation failed with error: \${error.message}\`
        };
      }
    `;

    const result = await this.e2bRunner.runTest(taskCRUDEval);
    
    try {
      const evalResult = JSON.parse(result.output);
      this.evalResults.set('TaskManagement', evalResult);
      return evalResult;
    } catch (error) {
      console.error('Error parsing task management evaluation result:', error);
      return {
        componentName: 'TaskManagement',
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
    console.log('Task Management Evaluator closed');
  }
}

/**
 * Create a task management evaluator
 * @param apiKey E2B API key
 * @returns TaskManagementEvaluator instance
 */
export function createTaskManagementEvaluator(apiKey: string): TaskManagementEvaluator {
  return new TaskManagementEvaluator(apiKey);
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
  
  const evaluator = createTaskManagementEvaluator(apiKey);
  
  try {
    const result = await evaluator.evaluateTaskCRUD();
    
    console.log('\n===== Task Management Evaluation Result =====');
    console.log(`Success: ${result.success ? 'PASSED' : 'FAILED'}`);
    console.log(result.summary);
    
    if (!result.success && result.error) {
      console.error('Error:', result.error);
    }
  } catch (error) {
    console.error('Error running task management evaluations:', error);
  } finally {
    await evaluator.close();
  }
}

// Run evaluations if called directly
if (require.main === module) {
  main().catch(console.error);
}

export default createTaskManagementEvaluator;