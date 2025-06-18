/**
 * Human-in-the-Loop Workflow Test Script
 * 
 * This script demonstrates how to run a workflow with human-in-the-loop capabilities,
 * handle workflow suspension, and resume the workflow with user input.
 */

import { Mastra } from '@mastra/core';
import { ConsoleLogger } from '@mastra/loggers';
import { v4 as uuidv4 } from 'uuid';
import { humanReviewWorkflow } from '../mastra-vnext-workflows';
import { EventStreamWriter } from '../mastra-vnext-utils';

// Configure runtime context for the test
const testRuntimeContext = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  EXA_API_KEY: process.env.EXA_API_KEY || '',
  JINA_API_KEY: process.env.JINA_API_KEY || '',
  E2B_API_KEY: process.env.E2B_API_KEY || '',
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  SCRAPYBARA_API_KEY: process.env.SCRAPYBARA_API_KEY || '',
  searchId: `test-${uuidv4()}`,
  userId: 'test-user-id',
};

/**
 * Run the human review workflow
 */
async function runHumanReviewWorkflow() {
  console.log('Starting Human Review Workflow Test');
  
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
  workflowRun.watch(event => {
    console.log(`[Event] Watch:`, event.payload?.currentStep);
  });
  
  workflowRun.onWorkflowEvent(event => {
    console.log(`[Event] Workflow: ${event.status}`);
    
    // Handle suspended workflow
    if (event.status === 'suspended') {
      console.log('Workflow suspended at step:', event.suspended?.stepId);
      console.log('Suspend data:', event.suspended?.data);
      
      // In a real implementation, this is where you'd save the state
      // and wait for user input
      
      // For testing, we'll automatically resume after a delay
      setTimeout(() => {
        resumeWorkflow(event.suspended);
      }, 2000);
    }
  });
  
  try {
    // Start the workflow
    const result = await workflowRun.start({
      inputData: {
        query: 'What are the benefits of exercise?',
        searchId: testRuntimeContext.searchId,
        userId: testRuntimeContext.userId
      },
      runtimeContext: testRuntimeContext
    });
    
    console.log('Workflow completed with status:', result.status);
    if (result.status === 'success') {
      console.log('Result:', result.result);
    } else if (result.status === 'failed') {
      console.error('Workflow failed:', result.error);
    }
  } catch (error) {
    console.error('Error running workflow:', error);
  }
}

/**
 * Resume a suspended workflow with user input
 */
async function resumeWorkflow(suspendedData: any) {
  if (!suspendedData) {
    console.error('Cannot resume: No suspended data provided');
    return;
  }
  
  const { stepId, data } = suspendedData;
  
  console.log(`Resuming workflow at step ${stepId}`);
  
  if (stepId === 'human-review') {
    // In a real implementation, this data would come from user interaction
    const userSelectedIndices = data.suggestedSelection || [0, 1];
    const userInstructions = 'Please focus on scientific evidence for exercise benefits';
    
    try {
      // Initialize Mastra again (in a real app, you'd preserve the instance)
      const mastra = new Mastra({
        logger: new ConsoleLogger('info'),
        vnext_workflows: {
          humanReviewWorkflow
        }
      });
      
      // Get the workflow again
      const resumedRun = humanReviewWorkflow.createRun();
      
      // Resume the workflow
      const resumeResult = await resumedRun.resume({
        searchId: testRuntimeContext.searchId,
        stepId: stepId,
        resumeData: {
          selectedResultIndices: userSelectedIndices,
          additionalInstructions: userInstructions,
          resumedAt: new Date().toISOString()
        },
        runtimeContext: testRuntimeContext
      });
      
      console.log('Workflow resumed with status:', resumeResult.status);
      if (resumeResult.status === 'success') {
        console.log('Result:', resumeResult.result);
      } else if (resumeResult.status === 'failed') {
        console.error('Resumed workflow failed:', resumeResult.error);
      }
    } catch (resumeError) {
      console.error('Error resuming workflow:', resumeError);
    }
  } else {
    console.log(`Unsupported suspend step: ${stepId}`);
  }
}

// Only execute if run directly
if (require.main === module) {
  runHumanReviewWorkflow().catch(console.error);
}