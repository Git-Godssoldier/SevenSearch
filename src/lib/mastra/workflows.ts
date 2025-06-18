import { Workflow, WorkflowContext } from './index';
import { providerRegistry } from '../providers';
import { AggregationStep } from '../aggregation';

export function createSearchWorkflow(): Workflow {
  const searchProvidersWorkflow = new Workflow();
  const providers = providerRegistry.getAllProviders();

  for (const provider of providers) {
    const config = provider.getDefaultConfig();
    searchProvidersWorkflow.addStep(provider.createStep(config));
  }

  const mainWorkflow = new Workflow();
  mainWorkflow.addStep({
    getName: () => 'parallel-search',
    execute: async (context: WorkflowContext) => {
      await searchProvidersWorkflow.executeParallel(context);
    },
  });
  mainWorkflow.addStep(new AggregationStep());

  return mainWorkflow;
}
