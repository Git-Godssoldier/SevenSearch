/**
 * Mastra vNext Recursive Improvement Script
 * 
 * This script implements a recursive improvement process for Mastra vNext workflows
 * using E2B secure runtime and code analysis. It runs tests, analyzes results,
 * suggests improvements, and can apply them to enhance workflow reliability.
 */

import dotenv from 'dotenv';
import { createRecursiveImprovementManager } from './recursive-improvement';

// Load environment variables
dotenv.config();

// Get E2B API key from environment
const E2B_API_KEY = process.env.E2B_API_KEY || '';

if (!E2B_API_KEY) {
  console.error('E2B_API_KEY environment variable not set');
  process.exit(1);
}

/**
 * Main execution function
 */
async function main() {
  console.log('Starting Mastra vNext Recursive Improvement Process');
  
  const improvementManager = createRecursiveImprovementManager(E2B_API_KEY);
  
  try {
    // Run the improvement cycle
    console.log('\n=== STARTING IMPROVEMENT CYCLE ===\n');
    const improvements = await improvementManager.runImprovementCycle();
    
    // Report the results
    console.log('\n=== IMPROVEMENT CYCLE RESULTS ===\n');
    console.log(`Found ${improvements.length} potential improvements`);
    
    // Filter high priority improvements
    const highPriorityImprovements = improvements.filter(imp => imp.priority === 'high');
    
    if (highPriorityImprovements.length > 0) {
      console.log('\n=== HIGH PRIORITY IMPROVEMENTS ===\n');
      highPriorityImprovements.forEach((improvement, index) => {
        console.log(`[${index + 1}] Improvement for ${improvement.stepId}`);
        console.log(`Component: ${improvement.component}`);
        console.log(`Issue: ${improvement.issue}`);
        console.log(`Suggestion: ${improvement.suggestion}`);
        console.log('---');
      });
      
      // Apply high priority improvements
      console.log('\nApplying high priority improvements...');
      await improvementManager.applyImprovements(highPriorityImprovements);
    } else {
      console.log('\nNo high priority improvements found.');
    }
    
    // Close the improvement manager
    await improvementManager.close();
    console.log('\n🎉 Recursive improvement process completed!');
  } catch (error) {
    console.error('Error in recursive improvement process:', error);
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  main().catch(err => {
    console.error('Uncaught error:', err);
    process.exit(1);
  });
}

export { main };