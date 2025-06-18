/**
 * E2B SevenSearch Testing Framework
 * Comprehensive testing for search functionality and HALO orchestration
 */

import { haloOrchestrator } from '../orchestration/halo-search-framework';

export interface SearchTestResult {
  testName: string;
  status: 'success' | 'failed' | 'error';
  timestamp: number;
  duration: number;
  data: any;
  error?: string;
}

export class SevenSearchE2BTester {
  private testResults: SearchTestResult[] = [];
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Log test results for analysis
   */
  private logTest(testName: string, status: SearchTestResult['status'], data: any, duration: number, error?: string): SearchTestResult {
    const result: SearchTestResult = {
      testName,
      status,
      timestamp: Date.now(),
      duration,
      data,
      error
    };

    this.testResults.push(result);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST: ${testName}`);
    console.log(`STATUS: ${status.toUpperCase()}`);
    console.log(`DURATION: ${duration}ms`);
    console.log(`${'='.repeat(60)}`);
    
    if (error) {
      console.error(`ERROR: ${error}`);
    }
    
    console.log(JSON.stringify(data, null, 2));
    
    return result;
  }

  /**
   * Test HALO orchestrator direct execution
   */
  async testHALODirectExecution(query: string): Promise<SearchTestResult> {
    const startTime = Date.now();
    
    try {
      console.log(`\n🔍 Testing HALO direct execution with query: "${query}"`);
      
      const searchResult = await haloOrchestrator.executeSearch(query);
      const duration = Date.now() - startTime;
      
      const analysisData = {
        query,
        results_count: searchResult.results.length,
        plan: searchResult.plan,
        metrics: searchResult.metrics,
        validation: searchResult.validation,
        sample_result: searchResult.results[0] || null,
        quality_scores: searchResult.results.map(r => ({
          relevance: r.relevanceScore,
          credibility: r.credibilityScore,
          freshness: r.freshnessScore
        })),
        engine_performance: searchResult.metrics.enginePerformance,
        recommendations: searchResult.validation.recommendations
      };

      return this.logTest(
        `HALO Direct Execution - ${query}`,
        searchResult.results.length > 0 ? 'success' : 'failed',
        analysisData,
        duration
      );

    } catch (error) {
      const duration = Date.now() - startTime;
      return this.logTest(
        `HALO Direct Execution - ${query}`,
        'error',
        { query, error_details: error },
        duration,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Test search API endpoint
   */
  async testSearchAPIEndpoint(query: string): Promise<SearchTestResult> {
    const startTime = Date.now();
    
    try {
      console.log(`\n🌐 Testing Search API endpoint with query: "${query}"`);
      
      const response = await fetch(`${this.baseUrl}/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          category: 'general'
        })
      });

      const duration = Date.now() - startTime;
      const responseData = await response.json();

      const analysisData = {
        query,
        status_code: response.status,
        response_time: duration,
        response_size: JSON.stringify(responseData).length,
        results_count: responseData.results?.length || 0,
        has_metrics: 'metrics' in responseData,
        has_validation: 'validation' in responseData,
        search_id: responseData.searchId,
        validation_passed: responseData.validation?.passed,
        quality_score: responseData.validation?.score,
        sample_result: responseData.results?.[0],
        is_mock_data: responseData.note?.includes('Mock') || false
      };

      return this.logTest(
        `Search API Endpoint - ${query}`,
        response.ok ? 'success' : 'failed',
        analysisData,
        duration
      );

    } catch (error) {
      const duration = Date.now() - startTime;
      return this.logTest(
        `Search API Endpoint - ${query}`,
        'error',
        { query, fetch_error: true },
        duration,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Test search result formatting
   */
  async testSearchResultFormatting(): Promise<SearchTestResult> {
    const startTime = Date.now();
    
    try {
      console.log(`\n📊 Testing search result formatting`);
      
      // Get search results from HALO
      const searchResult = await haloOrchestrator.executeSearch("test query formatting");
      
      const formatTests = {
        results_structure: this.validateResultsStructure(searchResult.results),
        metrics_structure: this.validateMetricsStructure(searchResult.metrics),
        validation_structure: this.validateValidationStructure(searchResult.validation),
        response_streaming: this.testResponseStreamingFormat(searchResult)
      };

      const duration = Date.now() - startTime;
      const allTestsPassed = Object.values(formatTests).every(test => test.passed);

      return this.logTest(
        'Search Result Formatting',
        allTestsPassed ? 'success' : 'failed',
        formatTests,
        duration
      );

    } catch (error) {
      const duration = Date.now() - startTime;
      return this.logTest(
        'Search Result Formatting',
        'error',
        { formatting_test_error: true },
        duration,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Validate search results structure
   */
  private validateResultsStructure(results: any[]): { passed: boolean; issues: string[] } {
    const issues: string[] = [];
    
    if (!Array.isArray(results)) {
      issues.push('Results is not an array');
      return { passed: false, issues };
    }

    for (const [index, result] of results.entries()) {
      const requiredFields = ['id', 'title', 'content', 'url', 'source', 'relevanceScore', 'credibilityScore', 'freshnessScore', 'timestamp'];
      
      for (const field of requiredFields) {
        if (!(field in result)) {
          issues.push(`Result ${index} missing field: ${field}`);
        }
      }

      // Validate score ranges
      if (result.relevanceScore < 0 || result.relevanceScore > 1) {
        issues.push(`Result ${index} relevanceScore out of range: ${result.relevanceScore}`);
      }
      if (result.credibilityScore < 0 || result.credibilityScore > 1) {
        issues.push(`Result ${index} credibilityScore out of range: ${result.credibilityScore}`);
      }
      if (result.freshnessScore < 0 || result.freshnessScore > 1) {
        issues.push(`Result ${index} freshnessScore out of range: ${result.freshnessScore}`);
      }
    }

    return { passed: issues.length === 0, issues };
  }

  /**
   * Validate metrics structure
   */
  private validateMetricsStructure(metrics: any): { passed: boolean; issues: string[] } {
    const issues: string[] = [];
    const requiredFields = ['planningTime', 'executionTime', 'processingTime', 'verificationTime', 'totalTime', 'successRate', 'qualityScore', 'enginePerformance'];

    for (const field of requiredFields) {
      if (!(field in metrics)) {
        issues.push(`Metrics missing field: ${field}`);
      }
    }

    if (metrics.successRate < 0 || metrics.successRate > 1) {
      issues.push(`successRate out of range: ${metrics.successRate}`);
    }
    if (metrics.qualityScore < 0 || metrics.qualityScore > 1) {
      issues.push(`qualityScore out of range: ${metrics.qualityScore}`);
    }

    return { passed: issues.length === 0, issues };
  }

  /**
   * Validate validation structure
   */
  private validateValidationStructure(validation: any): { passed: boolean; issues: string[] } {
    const issues: string[] = [];
    const requiredFields = ['passed', 'score', 'issues', 'recommendations'];

    for (const field of requiredFields) {
      if (!(field in validation)) {
        issues.push(`Validation missing field: ${field}`);
      }
    }

    if (typeof validation.passed !== 'boolean') {
      issues.push('Validation.passed is not boolean');
    }
    if (validation.score < 0 || validation.score > 1) {
      issues.push(`Validation score out of range: ${validation.score}`);
    }
    if (!Array.isArray(validation.issues)) {
      issues.push('Validation.issues is not an array');
    }
    if (!Array.isArray(validation.recommendations)) {
      issues.push('Validation.recommendations is not an array');
    }

    return { passed: issues.length === 0, issues };
  }

  /**
   * Test response streaming format
   */
  private testResponseStreamingFormat(searchResult: any): { passed: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check if the response can be serialized for streaming
    try {
      const serialized = JSON.stringify(searchResult);
      const parsed = JSON.parse(serialized);
      
      if (!parsed.results || !parsed.metrics || !parsed.validation) {
        issues.push('Response missing required sections for streaming');
      }
    } catch (error) {
      issues.push(`Response not serializable for streaming: ${error}`);
    }

    return { passed: issues.length === 0, issues };
  }

  /**
   * Run comprehensive test suite
   */
  async runComprehensiveTests(): Promise<void> {
    console.log('\n🚀 Starting SevenSearch E2B Comprehensive Test Suite');
    console.log('='.repeat(60));

    const testQueries = [
      'artificial intelligence trends 2024',
      'climate change solutions',
      'how to learn typescript',
      'latest news technology',
      'best programming practices'
    ];

    // Test 1: HALO Direct Execution
    console.log('\n📋 Phase 1: HALO Direct Execution Tests');
    for (const query of testQueries.slice(0, 3)) {
      await this.testHALODirectExecution(query);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
    }

    // Test 2: Search API Endpoint
    console.log('\n📋 Phase 2: Search API Endpoint Tests');
    for (const query of testQueries.slice(0, 2)) {
      await this.testSearchAPIEndpoint(query);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
    }

    // Test 3: Search Result Formatting
    console.log('\n📋 Phase 3: Search Result Formatting Tests');
    await this.testSearchResultFormatting();

    // Generate summary report
    this.generateTestReport();
  }

  /**
   * Generate comprehensive test report
   */
  generateTestReport(): void {
    console.log('\n📊 TEST SUITE SUMMARY REPORT');
    console.log('='.repeat(80));

    const totalTests = this.testResults.length;
    const successfulTests = this.testResults.filter(t => t.status === 'success').length;
    const failedTests = this.testResults.filter(t => t.status === 'failed').length;
    const errorTests = this.testResults.filter(t => t.status === 'error').length;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Successful: ${successfulTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`🚨 Errors: ${errorTests}`);
    console.log(`Success Rate: ${((successfulTests / totalTests) * 100).toFixed(1)}%`);

    console.log('\n📈 PERFORMANCE METRICS');
    console.log('-'.repeat(40));
    const avgDuration = this.testResults.reduce((sum, t) => sum + t.duration, 0) / totalTests;
    console.log(`Average Test Duration: ${avgDuration.toFixed(0)}ms`);

    console.log('\n🔍 KEY FINDINGS');
    console.log('-'.repeat(40));
    
    const mockDataTests = this.testResults.filter(t => 
      t.data && (t.data.is_mock_data || (t.data.sample_result && t.data.sample_result.source === 'mock'))
    );
    
    if (mockDataTests.length > 0) {
      console.log('⚠️  Mock data detected - real search engines not configured');
    }

    const formattingIssues = this.testResults.filter(t => 
      t.testName.includes('Formatting') && t.status !== 'success'
    );
    
    if (formattingIssues.length > 0) {
      console.log('⚠️  Search result formatting issues detected');
    }

    console.log('\n💡 RECOMMENDATIONS');
    console.log('-'.repeat(40));
    console.log('1. Configure real search engine API keys (Exa, Jina, Firecrawl)');
    console.log('2. Implement proper response streaming');
    console.log('3. Add comprehensive error handling');
    console.log('4. Test with production environment variables');
    console.log('5. Implement rate limiting and caching');

    console.log('\n📋 DETAILED TEST RESULTS');
    console.log('-'.repeat(40));
    this.testResults.forEach((test, index) => {
      console.log(`${index + 1}. ${test.testName}: ${test.status.toUpperCase()} (${test.duration}ms)`);
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      }
    });
  }

  /**
   * Get test results for external analysis
   */
  getTestResults(): SearchTestResult[] {
    return this.testResults;
  }
}

// Export for use in other test files
export default SevenSearchE2BTester;