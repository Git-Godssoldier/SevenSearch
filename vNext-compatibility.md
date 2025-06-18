# Mastra vNext Compatibility Plan

This document outlines the plan to ensure full compatibility with Mastra vNext for the Q Search application.

## Current Implementation

Currently, Q Search uses a basic emulation of Mastra's workflow system, as seen in:

- `/src/lib/mastra-types.ts`: Contains basic workflow and step type definitions
- `/src/lib/mastra-workflows/search-workflow.ts`: Defines our workflow structure
- `/src/lib/mastra-steps/`: Contains individual implementation steps

Our implementation provides:
- Step-based workflow execution
- Parallel execution of independent steps
- Branching based on query complexity
- Error handling and timeouts
- Streaming updates to the client

## Mastra vNext Features to Implement

To fully utilize Mastra vNext capabilities, we need to:

1. **Replace the emulated workflow system with Mastra's native implementation**
   - Update imports to use the official Mastra package
   - Replace our custom types with Mastra's type system
   - Use Mastra's workflow execution engine

2. **Implement efficient state management**
   - Leverage Mastra's built-in state management
   - Implement proper caching and retrieval mechanisms
   - Use Mastra's checkpointing for long-running workflows

3. **Improve error handling and recovery**
   - Use Mastra's retry mechanisms
   - Implement workflow resumption capabilities
   - Add more granular error reporting

4. **Enhance streaming capabilities**
   - Replace custom TransformStream implementation with Mastra's streaming
   - Use Mastra's event system for real-time updates
   - Implement proper backpressure handling

5. **Human-in-the-Loop Integration** ✅
   - Implement Mastra vNext's workflow suspension and resumption capabilities
   - Create UI components for human interaction during suspension
   - Store suspended workflow state in Supabase
   - Implement resume API endpoints to continue workflows after human input

## API Changes Required

1. **Update workflow definitions**
   ```typescript
   // Current implementation
   export const qSearchWorkflow = createWorkflow({
     name: 'QSearchWorkflow',
     inputSchema: UserQueryInputSchema,
     outputSchema: z.object({
       summary: z.any(),
       searchId: z.string(),
       metadata: z.record(z.string(), z.any()).optional()
     }),
     steps: { /* ... */ }
   });

   // vNext implementation
   import { Workflow, step } from '@mastra/core';

   export const qSearchWorkflow = new Workflow({
     name: 'QSearchWorkflow',
     input: UserQueryInput,
     steps: {
       planningStep: step(planningAndQueryEnhancementStep, {
         input: ({ input }) => ({ originalQuery: input.query }),
         onComplete: async (ctx, output) => { /* ... */ }
       }),
       // Other steps...
     }
   });
   ```

2. **Update step definitions**
   ```typescript
   // Current implementation
   export const exaSearchStep = createStep({
     name: 'ExaSearchStep',
     inputSchema: SearchProviderInputSchema,
     outputSchema: IndividualSearchResultsSchema,
     execute: async ({ data, context }) => { /* ... */ }
   });

   // vNext implementation
   import { defineStep } from '@mastra/core';

   export const exaSearchStep = defineStep({
     name: 'ExaSearchStep',
     input: SearchProviderInput,
     output: IndividualSearchResults,
     execute: async ({ input, context }) => { /* ... */ }
   });
   ```

3. **Update API route handlers**
   ```typescript
   // Current implementation
   const workflowResult = await qSearchWorkflow.execute(workflowInput, {
     context: workflowContext
   });

   // vNext implementation
   const workflowRunner = new WorkflowRunner({
     workflow: qSearchWorkflow,
     logger: new ConsoleLogger()
   });

   const workflowResult = await workflowRunner.run(workflowInput, {
     context: workflowContext
   });

   // Handle suspended workflows
   if (workflowResult.status === 'suspended') {
     // Store suspension state in database
     await supabase.from('suspended_workflows').insert({
       searchId: workflowInput.searchId,
       user_id: workflowContext.userId,
       suspended_step_id: workflowResult.suspended.stepId,
       suspend_data: workflowResult.suspended.data,
       workflow_state: workflowResult.state
     });
   }
   ```

4. **Human-in-the-Loop Step Definition**
   ```typescript
   // Human review step with suspension capability
   export const humanReviewStep = defineStep({
     name: 'HumanReviewStep',
     input: HumanReviewInput,
     output: HumanReviewOutput,
     suspendSchema: HumanReviewSuspendSchema,
     resumeSchema: HumanReviewResumeSchema,
     execute: async ({ input, suspend, resumeData }) => {
       // If no resume data, suspend workflow
       if (!resumeData) {
         await suspend({
           searchResults: input.searchResults,
           suggestedSelection: [0, 1, 2] // Default selection
         });
         return null; // Workflow pauses here
       }

       // Process user selections from resume data
       return {
         selectedResults: resumeData.selectedResultIndices.map(
           idx => input.searchResults[idx]
         )
       };
     }
   });
   ```

## Streaming and Event System

Mastra vNext provides a more sophisticated event system:

```typescript
// vNext streaming implementation
import { StreamingEvents } from '@mastra/core';

const workflow = new Workflow({
  name: 'QSearchWorkflow',
  events: {
    onStepStart: (stepId) => {
      // Send update to client on step start
    },
    onStepComplete: (stepId, output) => {
      // Send update to client on step completion
    },
    onError: (error) => {
      // Handle error and send to client
    }
  }
});

// In API handler
const { readable, writable } = new TransformStream();
const encoder = new TextEncoder();

workflow.events.subscribe('stepUpdate', (event) => {
  const writer = writable.getWriter();
  writer.write(encoder.encode(JSON.stringify(event)));
  writer.releaseLock();
});

return new StreamingTextResponse(readable);
```

## Timeline for Implementation

1. **Phase 1: Environment Setup** (Completed)
   - Install and configure Mastra packages
   - Set up proper API keys and environment variables

2. **Phase 2: Workflow Definition Conversion** (In Progress)
   - Convert existing workflow definition to vNext format
   - Update all step definitions to use vNext APIs

3. **Phase 3: Human-in-the-Loop Implementation** (Completed ✅)
   - Implement workflow suspension and resumption capabilities
   - Create UI components for human interaction
   - Build API endpoints for checking suspension status and resumption
   - Set up database schema for suspended workflow state persistence

4. **Phase 3: API Route Updates** (In Progress)
   - Modify API handlers to use Mastra's workflow runner
   - Implement proper event subscription system
   - Update streaming implementation

5. **Phase 4: Advanced Features**
   - Add caching layer for results
   - Enhance state persistence mechanisms
   - Implement multi-stage approval workflows

6. **Phase 5: Testing and Optimization**
   - Comprehensive testing of all workflow paths
   - Performance optimization
   - Error recovery testing

## Expected Benefits

By fully implementing Mastra vNext, Q Search will gain:

1. **Improved Performance**
   - More efficient workflow execution
   - Better parallelization of steps
   - Optimized resource usage

2. **Enhanced Reliability**
   - Better error handling and recovery
   - Automatic retries for failed steps
   - State persistence and resumability

3. **Better Developer Experience**
   - Type-safe workflow definitions
   - Improved debugging capabilities
   - Simplified API for defining complex workflows

4. **Human-in-the-Loop Capabilities** ✅
   - Strategic workflow suspension points
   - User feedback integration at critical decision points
   - Improved search result quality through human judgment
   - Comprehensive suspended state persistence

5. **Advanced Features**
   - Workflow visualization
   - Real-time monitoring
   - Detailed analytics on workflow execution

## References

- [Mastra Documentation](https://mastra.dev)
- [Mastra vNext GitHub Repository](https://github.com/mastrajs/mastra)
- [Mastra vNext API Reference](https://docs.mastra.dev/api)
- [Human-in-the-Loop Documentation](./src/docs/HUMAN_IN_THE_LOOP.md)
- [Mastra Suspension and Resumption Guide](https://docs.mastra.dev/workflows/suspension)