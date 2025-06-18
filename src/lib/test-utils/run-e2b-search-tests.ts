#!/usr/bin/env node

/**
 * E2B SevenSearch Test Runner
 * Executes comprehensive search functionality tests
 */

import SevenSearchE2BTester from './e2b-search-tests';

async function main() {
  console.log('🔬 SevenSearch E2B Testing Framework');
  console.log('=====================================');
  console.log('Starting comprehensive search functionality tests...\n');

  // Initialize tester
  const tester = new SevenSearchE2BTester();

  try {
    // Run comprehensive test suite
    await tester.runComprehensiveTests();
    
    // Get results for analysis
    const results = tester.getTestResults();
    
    console.log('\n🎯 E2B TESTING COMPLETE');
    console.log('========================');
    console.log(`Total tests executed: ${results.length}`);
    console.log(`Success rate: ${(results.filter(r => r.status === 'success').length / results.length * 100).toFixed(1)}%`);
    
    // Exit with appropriate code
    const hasErrors = results.some(r => r.status === 'error');
    const hasFailed = results.some(r => r.status === 'failed');
    
    if (hasErrors) {
      console.log('❌ Tests completed with errors');
      process.exit(1);
    } else if (hasFailed) {
      console.log('⚠️  Tests completed with failures');
      process.exit(1);
    } else {
      console.log('✅ All tests passed successfully');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('💥 Critical testing error:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export default main;