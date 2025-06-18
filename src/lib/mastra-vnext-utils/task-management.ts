/**
 * Task Management for Project Gargantua
 * 
 * This module provides a comprehensive task management system
 * for maintaining to-do lists throughout workflow planning and execution.
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { supabase } from '@/lib/supabase';

// Task priority levels
export enum TaskPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

// Task status types
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
  CANCELLED = 'cancelled'
}

// Task schema definition
export const TaskSchema = z.object({
  id: z.string(),
  searchId: z.string(),
  userId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  priority: z.enum([TaskPriority.HIGH, TaskPriority.MEDIUM, TaskPriority.LOW]),
  status: z.enum([
    TaskStatus.PENDING,
    TaskStatus.IN_PROGRESS,
    TaskStatus.COMPLETED,
    TaskStatus.BLOCKED,
    TaskStatus.CANCELLED
  ]),
  dependsOn: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

// Task type definition
export type Task = z.infer<typeof TaskSchema>;

// Create task input schema
export const CreateTaskInputSchema = z.object({
  searchId: z.string(),
  userId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  priority: z.enum([TaskPriority.HIGH, TaskPriority.MEDIUM, TaskPriority.LOW])
    .default(TaskPriority.MEDIUM),
  dependsOn: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

// Update task input schema
export const UpdateTaskInputSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum([TaskPriority.HIGH, TaskPriority.MEDIUM, TaskPriority.LOW])
    .optional(),
  status: z.enum([
    TaskStatus.PENDING,
    TaskStatus.IN_PROGRESS,
    TaskStatus.COMPLETED,
    TaskStatus.BLOCKED,
    TaskStatus.CANCELLED
  ]).optional(),
  dependsOn: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

// Task list schema
export const TaskListSchema = z.array(TaskSchema);

// Task event types
export enum TaskEventType {
  TASK_CREATED = 'task_created',
  TASK_UPDATED = 'task_updated',
  TASK_COMPLETED = 'task_completed',
  TASK_CANCELLED = 'task_cancelled',
  TASK_LIST_UPDATED = 'task_list_updated'
}

/**
 * Task Manager
 * 
 * Manages task creation, updates, and tracking throughout the 
 * workflow planning and execution process.
 */
export class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private emitter: EventEmitter;
  private searchId: string;
  private userId: string;
  private isInitialized = false;

  /**
   * Create a new TaskManager instance
   * @param searchId The ID of the current search session
   * @param userId The ID of the current user
   * @param emitter Optional event emitter for task events
   */
  constructor(searchId: string, userId: string, emitter?: EventEmitter) {
    this.searchId = searchId;
    this.userId = userId;
    this.emitter = emitter || new EventEmitter();
  }

  /**
   * Initialize the task manager and load existing tasks
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Load existing tasks from database
    await this.loadTasks();
    this.isInitialized = true;
  }

  /**
   * Load tasks from Supabase database
   */
  private async loadTasks(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('searchId', this.searchId)
        .eq('userId', this.userId);

      if (error) {
        console.error('[TaskManager] Error loading tasks:', error);
        return;
      }

      // Parse and validate tasks
      const parsedTasks = TaskListSchema.safeParse(data);
      if (!parsedTasks.success) {
        console.error('[TaskManager] Invalid task data:', parsedTasks.error);
        return;
      }

      // Add tasks to the internal map
      parsedTasks.data.forEach(task => {
        this.tasks.set(task.id, task);
      });

      // Emit task list updated event
      this.emitEvent(TaskEventType.TASK_LIST_UPDATED, {
        searchId: this.searchId,
        userId: this.userId,
        taskCount: this.tasks.size
      });
    } catch (error) {
      console.error('[TaskManager] Error loading tasks:', error);
    }
  }

  /**
   * Create a new task
   * @param taskInput Task creation input
   * @returns The created task
   */
  async createTask(taskInput: z.infer<typeof CreateTaskInputSchema>): Promise<Task> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Parse and validate input
      const validatedInput = CreateTaskInputSchema.parse(taskInput);

      // Generate a new task
      const now = new Date().toISOString();
      const newTask: Task = {
        id: createId(),
        searchId: validatedInput.searchId || this.searchId,
        userId: validatedInput.userId || this.userId,
        title: validatedInput.title,
        description: validatedInput.description,
        priority: validatedInput.priority,
        status: TaskStatus.PENDING,
        dependsOn: validatedInput.dependsOn || [],
        createdAt: now,
        updatedAt: now,
        tags: validatedInput.tags || [],
        metadata: validatedInput.metadata || {}
      };

      // Save to database
      const { data, error } = await supabase
        .from('tasks')
        .insert(newTask)
        .select()
        .single();

      if (error) {
        console.error('[TaskManager] Error creating task:', error);
        throw new Error(`Failed to create task: ${error.message}`);
      }

      // Add to internal map
      const savedTask = data as Task;
      this.tasks.set(savedTask.id, savedTask);

      // Emit task created event
      this.emitEvent(TaskEventType.TASK_CREATED, {
        task: savedTask
      });

      return savedTask;
    } catch (error) {
      console.error('[TaskManager] Error creating task:', error);
      throw error;
    }
  }

  /**
   * Update an existing task
   * @param taskUpdate Task update input
   * @returns The updated task
   */
  async updateTask(taskUpdate: z.infer<typeof UpdateTaskInputSchema>): Promise<Task> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Parse and validate input
      const validatedUpdate = UpdateTaskInputSchema.parse(taskUpdate);

      // Check if task exists
      const existingTask = this.tasks.get(validatedUpdate.id);
      if (!existingTask) {
        throw new Error(`Task with ID ${validatedUpdate.id} not found`);
      }

      // Prepare update
      const now = new Date().toISOString();
      const updatedTask: Task = {
        ...existingTask,
        ...validatedUpdate,
        updatedAt: now,
        // Set completedAt if status is being set to completed
        completedAt: validatedUpdate.status === TaskStatus.COMPLETED ? now : existingTask.completedAt
      };

      // Save to database
      const { data, error } = await supabase
        .from('tasks')
        .update(updatedTask)
        .eq('id', updatedTask.id)
        .select()
        .single();

      if (error) {
        console.error('[TaskManager] Error updating task:', error);
        throw new Error(`Failed to update task: ${error.message}`);
      }

      // Update internal map
      const savedTask = data as Task;
      this.tasks.set(savedTask.id, savedTask);

      // Emit appropriate event
      if (validatedUpdate.status === TaskStatus.COMPLETED) {
        this.emitEvent(TaskEventType.TASK_COMPLETED, {
          task: savedTask
        });
      } else if (validatedUpdate.status === TaskStatus.CANCELLED) {
        this.emitEvent(TaskEventType.TASK_CANCELLED, {
          task: savedTask
        });
      } else {
        this.emitEvent(TaskEventType.TASK_UPDATED, {
          task: savedTask
        });
      }

      return savedTask;
    } catch (error) {
      console.error('[TaskManager] Error updating task:', error);
      throw error;
    }
  }

  /**
   * Complete a task
   * @param taskId ID of the task to complete
   * @returns The completed task
   */
  async completeTask(taskId: string): Promise<Task> {
    return this.updateTask({
      id: taskId,
      status: TaskStatus.COMPLETED
    });
  }

  /**
   * Cancel a task
   * @param taskId ID of the task to cancel
   * @returns The cancelled task
   */
  async cancelTask(taskId: string): Promise<Task> {
    return this.updateTask({
      id: taskId,
      status: TaskStatus.CANCELLED
    });
  }

  /**
   * Start working on a task
   * @param taskId ID of the task to start
   * @returns The in-progress task
   */
  async startTask(taskId: string): Promise<Task> {
    return this.updateTask({
      id: taskId,
      status: TaskStatus.IN_PROGRESS
    });
  }

  /**
   * Get all tasks
   * @returns Array of all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get tasks by status
   * @param status Status to filter by
   * @returns Array of tasks with the specified status
   */
  getTasksByStatus(status: TaskStatus): Task[] {
    return this.getAllTasks().filter(task => task.status === status);
  }

  /**
   * Get tasks by priority
   * @param priority Priority to filter by
   * @returns Array of tasks with the specified priority
   */
  getTasksByPriority(priority: TaskPriority): Task[] {
    return this.getAllTasks().filter(task => task.priority === priority);
  }

  /**
   * Get tasks by tag
   * @param tag Tag to filter by
   * @returns Array of tasks with the specified tag
   */
  getTasksByTag(tag: string): Task[] {
    return this.getAllTasks().filter(task => task.tags?.includes(tag));
  }

  /**
   * Get the next task to work on
   * This prioritizes tasks with no dependencies, highest priority,
   * and PENDING status
   * @returns The next task to work on, or undefined if none
   */
  getNextTask(): Task | undefined {
    const pendingTasks = this.getTasksByStatus(TaskStatus.PENDING);
    
    // Filter tasks with no dependencies (or all dependencies completed)
    const availableTasks = pendingTasks.filter(task => {
      // If no dependencies, task is available
      if (!task.dependsOn || task.dependsOn.length === 0) {
        return true;
      }
      
      // Check if all dependencies are completed
      return task.dependsOn.every(depId => {
        const depTask = this.tasks.get(depId);
        return depTask && depTask.status === TaskStatus.COMPLETED;
      });
    });
    
    // Sort by priority (HIGH > MEDIUM > LOW)
    const sortedTasks = availableTasks.sort((a, b) => {
      const priorityOrder = {
        [TaskPriority.HIGH]: 0,
        [TaskPriority.MEDIUM]: 1,
        [TaskPriority.LOW]: 2
      };
      
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    return sortedTasks[0];
  }

  /**
   * Add dependency between tasks
   * @param taskId ID of the dependent task
   * @param dependsOnId ID of the task it depends on
   * @returns The updated task
   */
  async addDependency(taskId: string, dependsOnId: string): Promise<Task> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    const dependsOnTask = this.tasks.get(dependsOnId);
    if (!dependsOnTask) {
      throw new Error(`Task with ID ${dependsOnId} not found`);
    }
    
    // Add dependency if not already present
    const dependencies = task.dependsOn || [];
    if (!dependencies.includes(dependsOnId)) {
      return this.updateTask({
        id: taskId,
        dependsOn: [...dependencies, dependsOnId]
      });
    }
    
    return task;
  }

  /**
   * Remove dependency between tasks
   * @param taskId ID of the dependent task
   * @param dependsOnId ID of the task to remove dependency on
   * @returns The updated task
   */
  async removeDependency(taskId: string, dependsOnId: string): Promise<Task> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    // Remove dependency if present
    const dependencies = task.dependsOn || [];
    if (dependencies.includes(dependsOnId)) {
      return this.updateTask({
        id: taskId,
        dependsOn: dependencies.filter(id => id !== dependsOnId)
      });
    }
    
    return task;
  }

  /**
   * Emit a task event
   * @param eventType Type of event to emit
   * @param payload Event payload
   */
  private emitEvent(eventType: TaskEventType, payload: any): void {
    this.emitter.emit(eventType, {
      type: eventType,
      timestamp: new Date().toISOString(),
      ...payload
    });
  }

  /**
   * Subscribe to task events
   * @param eventType Type of event to subscribe to
   * @param handler Event handler function
   * @returns Function to unsubscribe
   */
  subscribeToEvent(eventType: TaskEventType, handler: (event: any) => void): () => void {
    this.emitter.on(eventType, handler);
    return () => this.emitter.off(eventType, handler);
  }

  /**
   * Subscribe to all task events
   * @param handler Event handler function
   * @returns Function to unsubscribe
   */
  subscribeToAllEvents(handler: (event: any) => void): () => void {
    const eventTypes = Object.values(TaskEventType);
    
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
 * Create a new task manager
 * @param searchId Search ID for the task context
 * @param userId User ID for the task owner
 * @param emitter Optional event emitter for task events
 * @returns TaskManager instance
 */
export function createTaskManager(
  searchId: string,
  userId: string,
  emitter?: EventEmitter
): TaskManager {
  return new TaskManager(searchId, userId, emitter);
}

export default createTaskManager;