/**
 * Enhanced HALO Search Orchestration Framework
 * Integrates real search engines and improved streaming capabilities
 */

import { z } from 'zod';
import { searchEngineManager } from '../search-providers/real-search-implementation';

// Core types for HALO orchestration
export const SearchPlanSchema = z.object({
  query: z.string(),
  intent: z.enum(['research', 'quick_lookup', 'real_time', 'academic', 'code']),
  engines: z.array(z.string()),
  strategy: z.enum(['parallel', 'sequential', 'hybrid']),
  qualityThreshold: z.number().min(0).max(1),
  timeout: z.number(),
  expectedResultCount: z.number().optional()
});

export const SearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  url: z.string(),
  source: z.string(),
  relevanceScore: z.number(),
  credibilityScore: z.number(),
  freshnessScore: z.number(),
  timestamp: z.string()
});

export type SearchPlan = z.infer<typeof SearchPlanSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;

interface HALOMetrics {
  planningTime: number;
  executionTime: number;
  processingTime: number;
  verificationTime: number;
  totalTime: number;
  successRate: number;
  qualityScore: number;
  enginePerformance: Record<string, number>;
  engineStatus: Record<string, { enabled: boolean; configured: boolean }>;
}

/**
 * Enhanced Search Planner with environment awareness
 */
export class EnhancedSearchPlanner {
  private queryPatterns = new Map<string, SearchPlan>();
  private performanceHistory = new Map<string, HALOMetrics[]>();

  analyzeQuery(query: string): SearchPlan {
    // Intent recognition
    const intent = this.classifyIntent(query);
    
    // Engine selection based on availability and historical performance
    const engines = this.selectOptimalEngines(intent, query);
    
    // Strategy determination
    const strategy = this.determineStrategy(intent, engines.length);
    
    // Quality and timeout configuration
    const { qualityThreshold, timeout } = this.getQualityConfig(intent);
    
    const plan: SearchPlan = {
      query,
      intent,
      engines,
      strategy,
      qualityThreshold,
      timeout,
      expectedResultCount: this.estimateResultCount(intent)
    };

    // Cache successful patterns
    this.queryPatterns.set(this.getQueryHash(query), plan);
    
    return plan;
  }

  private classifyIntent(query: string): SearchPlan['intent'] {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('code') || lowerQuery.includes('programming') || lowerQuery.includes('tutorial')) {
      return 'code';
    }
    if (lowerQuery.includes('research') || lowerQuery.includes('study') || lowerQuery.includes('analysis')) {
      return 'academic';
    }
    if (lowerQuery.includes('news') || lowerQuery.includes('today') || lowerQuery.includes('current')) {
      return 'real_time';
    }
    if (lowerQuery.includes('how to') || lowerQuery.includes('quick') || lowerQuery.includes('what is')) {
      return 'quick_lookup';
    }
    
    return 'research'; // Default to comprehensive research
  }

  private selectOptimalEngines(intent: SearchPlan['intent'], _query: string): string[] {
    // Get engine status to only use configured engines
    const engineStatus = searchEngineManager.getEngineStatus();
    const availableEngines = Object.entries(engineStatus)
      .filter(([_, status]) => status.enabled && status.configured)
      .map(([engine, _]) => engine);

    if (availableEngines.length === 0) {
      console.warn('⚠️  No search engines configured - using fallback engines');
      return ['exa', 'jina']; // Fallback to mock
    }

    const engineMap: Record<SearchPlan['intent'], string[]> = {
      research: availableEngines.slice(0, 3), // Use up to 3 engines for research
      quick_lookup: availableEngines.slice(0, 1), // Use 1 engine for quick lookup
      real_time: availableEngines.filter(e => ['firecrawl', 'jina'].includes(e)),
      academic: availableEngines.filter(e => ['exa', 'jina'].includes(e)),
      code: availableEngines
    };
    
    const selectedEngines = engineMap[intent] || availableEngines.slice(0, 2);
    return selectedEngines.length > 0 ? selectedEngines : ['exa']; // Always return at least one
  }

  private determineStrategy(intent: SearchPlan['intent'], engineCount: number): SearchPlan['strategy'] {
    if (intent === 'real_time') return 'parallel';
    if (engineCount === 1) return 'sequential';
    if (intent === 'academic') return 'sequential';
    return 'parallel';
  }

  private getQualityConfig(intent: SearchPlan['intent']) {
    const configs = {
      research: { qualityThreshold: 0.8, timeout: 10000 },
      quick_lookup: { qualityThreshold: 0.6, timeout: 3000 },
      real_time: { qualityThreshold: 0.7, timeout: 5000 },
      academic: { qualityThreshold: 0.9, timeout: 15000 },
      code: { qualityThreshold: 0.7, timeout: 8000 }
    };
    
    return configs[intent] || { qualityThreshold: 0.7, timeout: 7000 };
  }

  private estimateResultCount(intent: SearchPlan['intent']): number {
    const counts = {
      research: 15,
      quick_lookup: 5,
      real_time: 10,
      academic: 8,
      code: 12
    };
    
    return counts[intent] || 10;
  }

  private getQueryHash(query: string): string {
    return Buffer.from(query.toLowerCase().trim()).toString('base64');
  }
}

/**
 * Enhanced Provider Coordinator with real search engine integration
 */
export class EnhancedProviderCoordinator {
  private engineHealth = new Map<string, boolean>();
  private engineLatency = new Map<string, number>();
  private requestCounts = new Map<string, number>();

  async executeSearchPlan(plan: SearchPlan): Promise<AsyncGenerator<SearchResult[], void, unknown>> {
    if (plan.strategy === 'parallel') {
      return this.executeParallelSearch(plan);
    } else {
      return this.executeSequentialSearch(plan);
    }
  }

  private async *executeParallelSearch(plan: SearchPlan): AsyncGenerator<SearchResult[], void, unknown> {
    console.log(`🚀 Executing parallel search with engines: ${plan.engines.join(', ')}`);
    
    const searchPromises = plan.engines.map(engine => 
      this.searchEngine(engine, plan.query, plan.timeout)
    );

    // Yield results as they arrive using Promise.allSettled for better error handling
    const settledPromises = await Promise.allSettled(searchPromises);
    
    for (const [index, result] of settledPromises.entries()) {
      const engine = plan.engines[index];
      
      if (result.status === 'fulfilled' && result.value.length > 0) {
        console.log(`✅ ${engine} returned ${result.value.length} results`);
        yield result.value;
      } else if (result.status === 'rejected') {
        console.error(`❌ ${engine} failed:`, result.reason);
      } else {
        console.warn(`⚠️  ${engine} returned no results`);
      }
    }
  }

  private async *executeSequentialSearch(plan: SearchPlan): AsyncGenerator<SearchResult[], void, unknown> {
    console.log(`🔄 Executing sequential search with engines: ${plan.engines.join(', ')}`);
    
    let enhancedQuery = plan.query;
    let previousResults: SearchResult[] = [];

    for (const engine of plan.engines) {
      try {
        console.log(`🔍 Searching ${engine} with query: "${enhancedQuery}"`);
        
        const results = await this.searchEngine(engine, enhancedQuery, plan.timeout);
        
        if (results.length > 0) {
          console.log(`✅ ${engine} returned ${results.length} results`);
          yield results;
          previousResults = [...previousResults, ...results];
          enhancedQuery = this.enhanceQueryWithContext(plan.query, previousResults);
        } else {
          console.warn(`⚠️  ${engine} returned no results`);
        }
      } catch (error) {
        console.error(`❌ Engine ${engine} failed:`, error);
        // Continue with next engine
      }
    }
  }

  private async searchEngine(engine: string, query: string, timeout: number): Promise<SearchResult[]> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Calling ${engine} search engine...`);
      
      // Use the real search engine manager instead of mock data
      const results = await searchEngineManager.searchEngine(engine, query, timeout);
      
      // Track performance
      const duration = Date.now() - startTime;
      this.engineLatency.set(engine, duration);
      this.engineHealth.set(engine, true);
      this.requestCounts.set(engine, (this.requestCounts.get(engine) || 0) + 1);
      
      console.log(`⏱️  ${engine} completed in ${duration}ms`);
      
      return results;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.engineLatency.set(engine, duration);
      this.engineHealth.set(engine, false);
      
      console.error(`❌ ${engine} error after ${duration}ms:`, error);
      throw error;
    }
  }

  private enhanceQueryWithContext(originalQuery: string, previousResults: SearchResult[]): string {
    // Extract key terms from previous results to enhance query
    const keyTerms = previousResults
      .flatMap(result => result.title.split(' '))
      .filter(term => term.length > 3)
      .slice(0, 3);
    
    return keyTerms.length > 0 
      ? `${originalQuery} ${keyTerms.join(' ')}`
      : originalQuery;
  }

  getEnginePerformance(): Record<string, { health: boolean; latency: number; requests: number }> {
    const performance: Record<string, { health: boolean; latency: number; requests: number }> = {};
    
    for (const [engine] of this.engineHealth) {
      performance[engine] = {
        health: this.engineHealth.get(engine) || false,
        latency: this.engineLatency.get(engine) || 0,
        requests: this.requestCounts.get(engine) || 0
      };
    }
    
    return performance;
  }
}

/**
 * Enhanced HALO Search Orchestrator with real search integration
 */
export class EnhancedHALOSearchOrchestrator {
  private planner = new EnhancedSearchPlanner();
  private coordinator = new EnhancedProviderCoordinator();

  async executeSearch(query: string): Promise<{
    results: SearchResult[];
    metrics: HALOMetrics;
    validation: any;
    plan: SearchPlan;
  }> {
    const startTime = Date.now();
    console.log(`🎯 Starting enhanced HALO search for: "${query}"`);
    
    // Layer 1: Planning
    const planStart = Date.now();
    const plan = this.planner.analyzeQuery(query);
    const planningTime = Date.now() - planStart;
    
    console.log(`📋 Search plan: ${plan.intent} intent, ${plan.strategy} strategy, engines: ${plan.engines.join(', ')}`);

    // Layer 2: Execution
    const execStart = Date.now();
    const resultsStream = await this.coordinator.executeSearchPlan(plan);
    const executionTime = Date.now() - execStart;

    // Layer 3: Processing
    const processStart = Date.now();
    const allResults: SearchResult[] = [];
    const seenUrls = new Set<string>();

    for await (const batchResults of resultsStream) {
      // Deduplicate by URL
      const uniqueResults = batchResults.filter(result => {
        if (seenUrls.has(result.url)) return false;
        seenUrls.add(result.url);
        return true;
      });

      // Quality filter
      const qualityResults = uniqueResults.filter(
        result => this.calculateOverallQuality(result) >= plan.qualityThreshold
      );

      allResults.push(...qualityResults);
    }

    // Sort by overall quality score
    allResults.sort((a, b) => 
      this.calculateOverallQuality(b) - this.calculateOverallQuality(a)
    );

    const results = allResults.slice(0, plan.expectedResultCount || 10);
    const processingTime = Date.now() - processStart;

    // Layer 4: Verification
    const verifyStart = Date.now();
    const validation = this.validateResults(results, plan);
    const verificationTime = Date.now() - verifyStart;

    const totalTime = Date.now() - startTime;
    const enginePerformance = this.coordinator.getEnginePerformance();
    const engineStatus = searchEngineManager.getEngineStatus();

    const metrics: HALOMetrics = {
      planningTime,
      executionTime,
      processingTime,
      verificationTime,
      totalTime,
      successRate: validation.passed ? 1 : 0,
      qualityScore: validation.score,
      enginePerformance: Object.fromEntries(
        Object.entries(enginePerformance).map(([engine, perf]) => [engine, perf.latency])
      ),
      engineStatus
    };

    console.log(`✅ HALO search completed in ${totalTime}ms with ${results.length} results`);

    return {
      results,
      metrics,
      validation,
      plan
    };
  }

  private calculateOverallQuality(result: SearchResult): number {
    // Weighted combination of quality metrics
    return (
      result.relevanceScore * 0.5 +
      result.credibilityScore * 0.3 +
      result.freshnessScore * 0.2
    );
  }

  private validateResults(results: SearchResult[], plan: SearchPlan): {
    passed: boolean;
    score: number;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check result count
    if (results.length === 0) {
      issues.push('No results returned');
      recommendations.push('Try broader search terms or different engines');
    }

    // Check quality distribution
    const avgQuality = results.length > 0 
      ? results.reduce((sum, r) => sum + this.calculateOverallQuality(r), 0) / results.length
      : 0;
    
    if (avgQuality < plan.qualityThreshold) {
      issues.push(`Average quality ${avgQuality.toFixed(2)} below threshold ${plan.qualityThreshold}`);
      recommendations.push('Consider using additional search engines or refining query');
    }

    // Check for mock data
    const mockResults = results.filter(r => 
      r.title.includes('[MOCK]') || 
      r.content.includes('Mock search result') ||
      r.url.includes('example.com')
    );
    
    if (mockResults.length > 0) {
      issues.push(`${mockResults.length} mock results detected`);
      recommendations.push('Configure real search engine API keys for actual results');
    }

    // Check source diversity
    const uniqueSources = new Set(results.map(r => r.source)).size;
    if (uniqueSources < 2 && plan.engines.length > 1) {
      issues.push('Low source diversity');
      recommendations.push('Ensure multiple search engines are working properly');
    }

    return {
      passed: issues.length === 0,
      score: avgQuality,
      issues,
      recommendations
    };
  }

  getSystemStatus() {
    const engineStatus = searchEngineManager.getEngineStatus();
    const enginePerformance = this.coordinator.getEnginePerformance();

    return {
      engines: engineStatus,
      performance: enginePerformance,
      timestamp: new Date().toISOString()
    };
  }
}

// Export enhanced singleton instance
export const enhancedHaloOrchestrator = new EnhancedHALOSearchOrchestrator();