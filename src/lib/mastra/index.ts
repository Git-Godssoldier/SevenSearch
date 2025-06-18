export interface Step {
  execute(context: WorkflowContext): Promise<void>;
  getName(): string;
}

export class WorkflowContext {
  private data: Record<string, any> = {};

  set(key: string, value: any): void {
    this.data[key] = value;
  }

  get(key: string): any {
    return this.data[key];
  }
}

export class Workflow {
  private steps: Step[] = [];

  addStep(step: Step): Workflow {
    this.steps.push(step);
    return this;
  }

  async execute(initialContext: WorkflowContext): Promise<WorkflowContext> {
    let context = initialContext
    for (const step of this.steps) {
      try {
        console.log(`Executing step: ${step.getName()}`)
        await step.execute(context)
      } catch (error) {
        console.error(`Error executing step ${step.getName()}:`, error)
        throw error
      }
    }
    return context
  }

  async executeParallel(initialContext: WorkflowContext): Promise<WorkflowContext> {
    let context = initialContext
    const promises = this.steps.map(step => {
      return (async () => {
        try {
          console.log(`Executing step in parallel: ${step.getName()}`)
          await step.execute(context)
        } catch (error) {
          console.error(`Error executing step ${step.getName()} in parallel:`, error)
          // Decide if one error should fail all. For now, we'll let others continue.
        }
      })()
    })

    await Promise.all(promises)
    return context
  }
}
