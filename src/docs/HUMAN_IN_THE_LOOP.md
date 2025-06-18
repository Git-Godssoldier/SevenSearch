# Human-in-the-Loop Implementation for Project Gargantua

This document provides a comprehensive overview of the human-in-the-loop capabilities implemented in Project Gargantua (formerly Q Search). The implementation allows workflows to be suspended at strategic points, wait for human input, and then resume with that input incorporated into the workflow.

## 1. Architecture Overview

The human-in-the-loop system is built on Mastra vNext's workflow suspension capabilities and consists of several interconnected components:

1. **Workflow Step with Suspend/Resume**: Core step implementation that can pause execution
2. **Database Persistence**: Storage for suspended workflow state in Supabase
3. **API Routes**: Endpoints for checking suspension status and resuming workflows
4. **Event Streaming**: Enhanced event handling for suspension notifications
5. **Client-Side UI**: Components for human interaction during suspension

This architecture enables seamless integration of human judgment into automated workflows, improving result quality and providing control points for users.

## 2. Core Components

### 2.1 Human Review Step

The `human-review-step.ts` file implements the core workflow step that can suspend execution and wait for human input:

```typescript
// Located at: src/lib/mastra-vnext-steps/human-review-step.ts

export const humanReviewStep = createStep({
  id: 'human-review',
  description: 'Pauses workflow for human input on search results',
  inputSchema: humanReviewInputSchema,
  outputSchema: humanReviewOutputSchema,
  suspendSchema: humanReviewSuspendSchema,
  resumeSchema: humanReviewResumeSchema,
  
  async execute({ 
    inputData, 
    resumeData, 
    suspend, 
    emitter, 
    runtimeContext 
  }) {
    // Initial execution (not resumed)
    if (!resumeData) {
      // Suspend workflow and wait for human input
      await suspend({
        searchResults: inputData.searchResults,
        query: inputData.query,
        enhancedQuery: inputData.enhancedQuery,
        suggestedSelection,
        userMessage: inputData.userMessage || 'Please select the most relevant search results to include in your answer:',
        suspendedAt: new Date().toISOString()
      });
      
      // Execution pauses here until resumed with human input
      return null;
    }
    
    // Process resumed data with human selections
    const selectedResults = resumeData.selectedResultIndices.map(
      index => inputData.searchResults[index]
    );
    
    return {
      selectedResults,
      additionalInstructions: resumeData.additionalInstructions,
      userSelection: true
    };
  }
});
```

The step uses Zod schemas to validate input, output, suspend, and resume data:

```typescript
// Input schema for human review
export const humanReviewInputSchema = z.object({
  searchResults: z.array(searchResultSchema),
  query: z.string(),
  enhancedQuery: z.string().optional(),
  userMessage: z.string().optional(),
});

// Suspend schema - data sent to client during workflow suspension
export const humanReviewSuspendSchema = z.object({
  searchResults: z.array(searchResultSchema),
  query: z.string(),
  enhancedQuery: z.string().optional(),
  suggestedSelection: z.array(z.number()),
  userMessage: z.string().optional(),
  suspendedAt: z.string(),
});

// Resume schema - data received from client to resume workflow
export const humanReviewResumeSchema = z.object({
  selectedResultIndices: z.array(z.number()),
  additionalInstructions: z.string().optional(),
  resumedAt: z.string(),
});
```

### 2.2 Database Persistence

A Supabase database table is used to store suspended workflow state:

```sql
-- Located at: migrations/02_create_suspended_workflows_table.sql

CREATE TABLE IF NOT EXISTS suspended_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  searchId TEXT NOT NULL,
  user_id TEXT NOT NULL,
  suspended_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  resumed_at TIMESTAMP WITH TIME ZONE,
  suspended_step_id TEXT NOT NULL,
  suspend_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  resume_data JSONB,
  workflow_state JSONB,
  is_suspended BOOLEAN NOT NULL DEFAULT TRUE,
  resume_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### 2.3 API Routes

Two API endpoints handle suspended workflows:

1. **GET /api/resume-workflow**: Checks if a workflow is suspended
2. **POST /api/resume-workflow**: Resumes a suspended workflow with user input

```typescript
// Located at: src/app/api/resume-workflow/route.ts

// GET endpoint to check if a workflow is suspended
export async function GET(request: Request) {
  // Extract searchId from URL
  const { searchParams } = new URL(request.url);
  const searchId = searchParams.get('searchId');
  
  // Check if the workflow exists and is suspended
  const { data: workflowData, error: fetchError } = await supabase
    .from('suspended_workflows')
    .select('*')
    .eq('searchId', searchId)
    .eq('user_id', userId)
    .eq('is_suspended', true)
    .single();
  
  // Return the suspension information
  return NextResponse.json({
    suspended: true,
    searchId,
    stepId: workflowData.suspended_step_id,
    suspendedAt: workflowData.suspended_at,
    suspendData: workflowData.suspend_data
  });
}

// POST endpoint to resume a suspended workflow
export async function POST(request: Request) {
  // Parse and validate request body
  const body = await request.json();
  
  const { searchId, stepId, resumeData } = body;
  
  // Mark workflow as being resumed in the database
  await supabase
    .from('suspended_workflows')
    .update({ 
      resumed_at: new Date().toISOString(),
      resume_data: resumeData,
      is_suspended: false
    })
    .eq('searchId', searchId)
    .eq('user_id', userId);
  
  return NextResponse.json({
    success: true,
    message: "Workflow resumption initiated",
    searchId,
    resumedAt: resumeData.resumedAt
  });
}
```

### 2.4 Client-Side Components

Two React components handle UI interactions:

1. **WorkflowSuspensionHandler**: Detects suspended workflows and shows appropriate UI
2. **HumanReviewInteraction**: UI for user selection and input during suspension

```tsx
// Located at: src/components/workflow-suspension-handler.tsx

export function WorkflowSuspensionHandler({ 
  searchId, 
  onResume 
}: WorkflowSuspensionHandlerProps) {
  // Check if workflow is suspended
  useEffect(() => {
    const checkSuspensionStatus = async () => {
      const response = await fetch(`/api/resume-workflow?searchId=${searchId}`);
      const data = await response.json();
      
      if (data.suspended) {
        setSuspensionData({
          stepId: data.stepId,
          suspendData: data.suspendData
        });
      }
    };
    
    checkSuspensionStatus();
  }, [searchId]);
  
  // Handle submission of human review
  const handleSubmitReview = async (selectedIndices: number[], additionalInstructions: string) => {
    await fetch('/api/resume-workflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchId,
        stepId: suspensionData.stepId,
        resumeData: {
          selectedResultIndices: selectedIndices,
          additionalInstructions: additionalInstructions || undefined,
          resumedAt: new Date().toISOString()
        }
      })
    });

    // Clear suspension data and notify parent
    setSuspensionData(null);
    onResume();
  };
}
```

The `HumanReviewInteraction` component provides a rich UI for users to select search results and provide additional instructions:

```tsx
// Located at: src/components/ui/human-review-interaction.tsx

export function HumanReviewInteraction({
  searchId,
  stepId,
  suspendData,
  onSubmit,
  onCancel
}: HumanReviewProps) {
  const { searchResults, query, enhancedQuery, suggestedSelection, userMessage } = suspendData;
  
  // State for selected indices
  const [selectedIndices, setSelectedIndices] = useState<number[]>(suggestedSelection || []);
  
  // State for additional instructions
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  
  // Handle submission
  const handleSubmit = async () => {
    await onSubmit(selectedIndices, additionalInstructions);
  };
  
  return (
    <div className="w-full max-w-3xl mx-auto">
      <Card className="p-6 mb-8 bg-white shadow-md dark:bg-gray-800">
        {/* UI for human review interaction */}
      </Card>
    </div>
  );
}
```

### 2.5 Event Streaming

The event streaming system is enhanced to support workflow suspension events:

```typescript
// Located at: src/lib/mastra-vnext-utils/stream-events.ts

export enum EventType {
  // Workflow Events
  WORKFLOW_STARTED = 'workflow_started',
  WORKFLOW_COMPLETED = 'workflow_completed',
  WORKFLOW_FAILED = 'workflow_failed',
  WORKFLOW_SUSPENDED = 'workflow_suspended',
  WORKFLOW_RESUMED = 'workflow_resumed',
  WORKFLOW_AWAITING_USER_INPUT = 'workflow_awaiting_user_input',
}

async sendWorkflowSuspended(searchId: string, stepId: string, suspendData: any = {}): Promise<boolean> {
  const stepInfo = this.getStepInfo(stepId);
  
  if (stepId === 'human-review') {
    return this.sendManualUpdate(stepInfo.clientStep, EventType.WORKFLOW_AWAITING_USER_INPUT, {
      searchId,
      suspendedStep: stepId,
      suspendData,
      description: 'Awaiting your input to continue the search',
      suspendedAt: new Date().toISOString()
    });
  }
}
```

## 3. Workflow Integration

The human review step can be integrated into any Mastra vNext workflow:

```typescript
// Located at: src/lib/mastra-vnext-workflows/human-review-workflow.ts

// Human review of search results
.then(aggregateResults => {
  // Prepare input for human review step
  return {
    searchResults: aggregateResults.aggregatedResults.slice(0, 10),
    query: humanReviewWorkflow.getInitData().query,
    enhancedQuery: humanReviewWorkflow.getStepResult(planningAndQueryEnhancementStep)?.enhancedQuery
  };
})
.then(humanReviewStep)

// RAG on selected results
.then(humanReviewOutput => {
  // Prepare for RAG with only selected results
  return {
    scrapedContents: humanReviewOutput.selectedResults.map(result => ({
      content: result.snippet || '',
      metadata: {},
      sourceInfo: {
        url: result.url,
        title: result.title
      }
    })),
  };
})
```

## 4. Testing and Evaluation

### 4.1 Basic Testing

A test script demonstrates how to run a workflow with human-in-the-loop capabilities:

```typescript
// Located at: src/lib/test-utils/test-human-in-the-loop.ts

async function runHumanReviewWorkflow() {
  // Initialize Mastra with the workflow
  const mastra = new Mastra({
    logger: new ConsoleLogger('info'),
    vnext_workflows: {
      humanReviewWorkflow
    }
  });

  // Create workflow run
  const workflowRun = humanReviewWorkflow.createRun();

  // Set up event listeners
  workflowRun.onWorkflowEvent(event => {
    // Handle suspended workflow
    if (event.status === 'suspended') {
      console.log('Workflow suspended at step:', event.suspended?.stepId);
      console.log('Suspend data:', event.suspended?.data);

      // For testing, automatically resume after a delay
      setTimeout(() => {
        resumeWorkflow(event.suspended);
      }, 2000);
    }
  });

  // Start the workflow
  const result = await workflowRun.start({
    inputData: {
      query: 'What are the benefits of exercise?',
      searchId: testRuntimeContext.searchId,
      userId: testRuntimeContext.userId
    },
    runtimeContext: testRuntimeContext
  });
}
```

### 4.2 E2B Secure Runtime Evaluation

The human-in-the-loop implementation is thoroughly tested using E2B secure runtime evaluation. This approach provides isolated testing environments for each component and their integration:

```typescript
// Located at: src/lib/test-utils/test-human-in-the-loop-e2b.ts

export class HumanReviewE2BTester {
  private e2bRunner: E2BTestRunner;
  private improvementManager: RecursiveImprovementManager;

  /**
   * Run the human review workflow test
   */
  async runHumanReviewWorkflowTest(): Promise<void> {
    // Test 1: Validate workflow suspension
    const suspensionTest = `
      // Mock implementation and testing of suspension
      // ...
    `;

    // Test 2: Validate workflow resumption
    const resumptionTest = `
      // Mock implementation and testing of resumption
      // ...
    `;

    // Run the tests in E2B secure environment
    const suspensionResult = await this.e2bRunner.runTest(suspensionTest);
    const resumptionResult = await this.e2bRunner.runTest(resumptionTest);

    // Look for potential improvements
    if (suspensionResult.success && resumptionResult.success) {
      const improvements = await this.improvementManager.runImprovementCycle();
      // Process improvement suggestions...
    }
  }
}
```

### 4.3 Component-Level Evaluations

Each component of the human-in-the-loop system is individually evaluated to ensure correctness:

```typescript
// Located at: src/lib/test-utils/workflow-component-evals.ts

export class WorkflowComponentEvaluator {
  // Evaluate human review step
  async evaluateHumanReviewStep(): Promise<any> {
    // Test cases for human review step
    // ...
  }

  // Evaluate workflow suspension handler
  async evaluateWorkflowSuspensionHandler(): Promise<any> {
    // Test scenarios for suspension handler
    // ...
  }

  // Evaluate resume workflow API
  async evaluateResumeWorkflowAPI(): Promise<any> {
    // Test cases for resume workflow API
    // ...
  }

  // Evaluate human review workflow integration
  async evaluateHumanReviewWorkflow(): Promise<any> {
    // Test cases for workflow integration
    // ...
  }
}
```

### 4.4 Running All Evaluations

A comprehensive evaluation suite runs all tests and provides a summary:

```typescript
// Located at: src/lib/test-utils/run-all-evals.ts

async function runAllEvaluations() {
  // Create all the evaluation instances
  const componentEvaluator = new WorkflowComponentEvaluator(apiKey);
  const humanReviewTester = new HumanReviewE2BTester(apiKey);
  const improvementManager = new RecursiveImprovementManager(apiKey);

  // Run component-level evaluations
  const componentResults = await componentEvaluator.runAllEvaluations();

  // Run integration tests
  await humanReviewTester.runAllTests();

  // Run improvement analysis
  const improvements = await improvementManager.runImprovementCycle();

  // Generate overall summary
  // ...
}
```

To run all evaluations:

```bash
# Set your E2B API key
export E2B_API_KEY=your_api_key_here

# Run the evaluation suite
npx ts-node src/lib/test-utils/run-all-evals.ts
```

## 5. Usage Flow

The following sequence describes how the human-in-the-loop system operates:

1. **Workflow Execution**: A workflow starts and reaches the human review step
2. **Suspension**: The step calls `suspend()` with data for client review
3. **Storage**: Suspension state is saved to the Supabase database
4. **Notification**: Client is notified via event streaming
5. **UI Display**: WorkflowSuspensionHandler shows HumanReviewInteraction component
6. **User Input**: User selects results and provides instructions
7. **Resumption**: Client calls API to resume workflow with user input
8. **Continuation**: Workflow continues with human selections incorporated

## 6. Implementation Guidelines

When implementing human-in-the-loop capabilities in your workflows:

1. **Schema Design**: Carefully design your input, output, suspend, and resume schemas
2. **Error Handling**: Implement robust error handling for suspension/resumption
3. **Default Fallbacks**: Provide sensible defaults if human input fails
4. **User Experience**: Design clear, intuitive UI for human interaction
5. **Security**: Validate user ownership before resuming workflows
6. **Timeouts**: Consider implementing expiration for suspended workflows

## 7. References

- [Mastra vNext Documentation on Workflow Suspension](https://docs.mastra.ai/vnext/workflows/suspension)
- [Project Gargantua Implementation Plan](./GARGANTUA_IMPLEMENTATION_PLAN.md)
- [Autonomous Agent Capabilities](./AUTONOMOUS_AGENT_CAPABILITIES.md)
- [Edge Function Streaming](https://vercel.com/docs/functions/streaming)
- [Supabase Data Storage](https://supabase.com/docs/guides/database)

## 8. Conclusion

The human-in-the-loop implementation enables Project Gargantua to combine autonomous operation with human judgment. This hybrid approach yields higher quality results, provides control points for users, and creates a more trustworthy AI system.

By implementing workflow suspension and resumption, we've created a foundation for more sophisticated human-AI collaboration patterns in the future, including multi-step approval flows, expert review cycles, and collaborative content creation.