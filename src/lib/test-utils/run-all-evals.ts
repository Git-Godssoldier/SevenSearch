/**
 * Run All Evaluations
 * 
 * This script runs all E2B evaluations for the human-in-the-loop implementation,
 * providing a comprehensive test of all components and their integration.
 */

import { E2BTestRunner } from './e2b-test-runner';
import { HumanReviewE2BTester } from './test-human-in-the-loop-e2b';
import { WorkflowComponentEvaluator } from './workflow-component-evals';
import { RecursiveImprovementManager } from './recursive-improvement';

// Define evaluation types
const EVAL_TYPES = {
  COMPONENT: 'component',
  INTEGRATION: 'integration',
  IMPROVEMENT: 'improvement'
};

/**
 * Run all evaluations for human-in-the-loop implementation
 */
async function runAllEvaluations() {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    console.error('E2B_API_KEY is required to run evaluations');
    process.exit(1);
  }

  console.log('\n===== RUNNING ALL HUMAN-IN-THE-LOOP EVALUATIONS =====\n');
  
  // Create all the evaluation instances
  const componentEvaluator = new WorkflowComponentEvaluator(apiKey);
  const humanReviewTester = new HumanReviewE2BTester(apiKey);
  const improvementManager = new RecursiveImprovementManager(apiKey);
  
  try {
    // Initialize all evaluators
    console.log('Initializing evaluators...');
    await Promise.all([
      componentEvaluator.initialize(),
      humanReviewTester.initialize(),
      improvementManager.initialize()
    ]);
    
    // Run component-level evaluations
    console.log('\n===== COMPONENT EVALUATIONS =====');
    console.log('Running evaluations for individual workflow components...');
    const componentResults = await componentEvaluator.runAllEvaluations();
    const componentSummary = componentEvaluator.getSummary();
    
    console.log('\nComponent Evaluation Results:');
    for (const result of componentSummary.results) {
      console.log(`- ${result.component}: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`  ${result.summary}`);
    }
    
    // Run integration tests
    console.log('\n===== INTEGRATION TESTS =====');
    console.log('Running human-in-the-loop integration tests...');
    await humanReviewTester.runAllTests();
    
    // Run improvement analysis
    console.log('\n===== IMPROVEMENT ANALYSIS =====');
    console.log('Analyzing code for potential improvements...');
    const improvements = await improvementManager.runImprovementCycle();
    
    console.log('\nImprovement Suggestions:');
    if (improvements.length > 0) {
      improvements.forEach((improvement, index) => {
        console.log(`\n[${index + 1}] ${improvement.priority.toUpperCase()} priority: ${improvement.stepId}`);
        console.log(`Component: ${improvement.component}`);
        console.log(`Issue: ${improvement.issue}`);
        console.log(`Suggestion: ${improvement.suggestion}`);
      });
    } else {
      console.log('No improvements suggested. The implementation is solid!');
    }
    
    // Generate overall summary
    const allSuccess = componentSummary.success;
    
    console.log('\n===== OVERALL EVALUATION SUMMARY =====');
    console.log(`Component Evaluations: ${componentSummary.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Integration Tests: Complete`);
    console.log(`Improvement Suggestions: ${improvements.length} found`);
    console.log(`\nOverall Status: ${allSuccess ? '✅ PASSED' : '❌ ISSUES FOUND'}`);
    
    if (!allSuccess) {
      console.log('\nPlease review the evaluation results and fix any failing tests.');
    }
    
    // Return the overall results
    return {
      components: componentSummary,
      improvements: improvements,
      success: allSuccess
    };
  } catch (error) {
    console.error('Error running evaluations:', error);
    return {
      error: error.message,
      success: false
    };
  } finally {
    // Close all evaluators
    await Promise.all([
      componentEvaluator.close(),
      humanReviewTester.close(),
      improvementManager.close()
    ]);
  }
}

/**
 * Execute specific evaluation types
 * @param types Array of evaluation types to run
 */
async function runEvaluations(types: string[] = Object.values(EVAL_TYPES)) {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    console.error('E2B_API_KEY is required to run evaluations');
    process.exit(1);
  }
  
  try {
    if (types.includes(EVAL_TYPES.COMPONENT)) {
      console.log('\nRunning component evaluations...');
      const evaluator = new WorkflowComponentEvaluator(apiKey);
      await evaluator.initialize();
      await evaluator.runAllEvaluations();
      const summary = evaluator.getSummary();
      console.log(`Component evaluation: ${summary.success ? 'PASSED' : 'FAILED'}`);
      await evaluator.close();
    }
    
    if (types.includes(EVAL_TYPES.INTEGRATION)) {
      console.log('\nRunning integration tests...');
      const tester = new HumanReviewE2BTester(apiKey);
      await tester.initialize();
      await tester.runAllTests();
      await tester.close();
    }
    
    if (types.includes(EVAL_TYPES.IMPROVEMENT)) {
      console.log('\nRunning improvement analysis...');
      const manager = new RecursiveImprovementManager(apiKey);
      await manager.initialize();
      const improvements = await manager.runImprovementCycle();
      console.log(`Found ${improvements.length} potential improvements`);
      await manager.close();
    }
    
    console.log('\nAll requested evaluations completed.');
  } catch (error) {
    console.error('Error running evaluations:', error);
    process.exit(1);
  }
}

// Run all evaluations if called directly
if (require.main === module) {
  runAllEvaluations().catch(console.error);
}

export {
  runAllEvaluations,
  runEvaluations,
  EVAL_TYPES
};