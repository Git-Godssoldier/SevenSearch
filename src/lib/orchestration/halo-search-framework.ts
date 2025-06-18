/**
 * HALO Search Orchestration Framework
 * 
 * Hierarchical Adaptive Learning Orchestration (HALO) for SevenSearch
 * Implements the 5-layer architecture from Poseidon system prompt
 */

import { z } from 'zod'

// Core types for HALO orchestration
export const SearchPlanSchema = z.object({
  query: z.string(),
  intent: z.enum(['research', 'quick_lookup', 'real_time', 'academic', 'code']),
  engines: z.array(z.string()),
  strategy: z.enum(['parallel', 'sequential', 'hybrid']),
  qualityThreshold: z.number().min(0).max(1),
  timeout: z.number(),
  expectedResultCount: z.number().optional()
})

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
})

export type SearchPlan = z.infer<typeof SearchPlanSchema>
export type SearchResult = z.infer<typeof SearchResultSchema>

interface HALOMetrics {
  planningTime: number
  executionTime: number
  processingTime: number
  verificationTime: number
  totalTime: number
  successRate: number
  qualityScore: number
  enginePerformance: Record<string, number>
}

/**
 * 1. Search Planner (Strategic Layer)
 * Intelligent breakdown of search requests and engine selection
 */
export class SearchPlanner {
  private queryPatterns = new Map<string, SearchPlan>()
  private performanceHistory = new Map<string, HALOMetrics[]>()

  analyzeQuery(query: string): SearchPlan {
    
    // Intent recognition
    const intent = this.classifyIntent(query)
    
    // Engine selection based on intent and historical performance
    const engines = this.selectOptimalEngines(intent, query)
    
    // Strategy determination
    const strategy = this.determineStrategy(intent, engines.length)
    
    // Quality and timeout configuration
    const { qualityThreshold, timeout } = this.getQualityConfig(intent)
    
    const plan: SearchPlan = {
      query,
      intent,
      engines,
      strategy,
      qualityThreshold,
      timeout,
      expectedResultCount: this.estimateResultCount(intent)
    }

    // Cache successful patterns
    this.queryPatterns.set(this.getQueryHash(query), plan)
    
    return plan
  }

  private classifyIntent(query: string): SearchPlan['intent'] {
    const lowerQuery = query.toLowerCase()
    
    if (lowerQuery.includes('code') || lowerQuery.includes('programming') || lowerQuery.includes('tutorial')) {
      return 'code'
    }
    if (lowerQuery.includes('research') || lowerQuery.includes('study') || lowerQuery.includes('analysis')) {
      return 'academic'
    }
    if (lowerQuery.includes('news') || lowerQuery.includes('today') || lowerQuery.includes('current')) {
      return 'real_time'
    }
    if (lowerQuery.includes('how to') || lowerQuery.includes('quick') || lowerQuery.includes('what is')) {
      return 'quick_lookup'
    }
    
    return 'research' // Default to comprehensive research
  }

  private selectOptimalEngines(intent: SearchPlan['intent'], _query: string): string[] {
    const engineMap = {
      research: ['exa', 'jina', 'firecrawl'],
      quick_lookup: ['exa'],
      real_time: ['firecrawl', 'jina'],
      academic: ['exa', 'academic_sources'],
      code: ['github_search', 'exa', 'stackoverflow']
    }
    
    return engineMap[intent] || ['exa', 'jina']
  }

  private determineStrategy(intent: SearchPlan['intent'], engineCount: number): SearchPlan['strategy'] {
    if (intent === 'real_time') return 'parallel'
    if (engineCount === 1) return 'sequential'
    if (intent === 'academic') return 'sequential'
    return 'parallel'
  }

  private getQualityConfig(intent: SearchPlan['intent']) {
    const configs = {
      research: { qualityThreshold: 0.8, timeout: 10000 },
      quick_lookup: { qualityThreshold: 0.6, timeout: 3000 },
      real_time: { qualityThreshold: 0.7, timeout: 5000 },
      academic: { qualityThreshold: 0.9, timeout: 15000 },
      code: { qualityThreshold: 0.7, timeout: 8000 }
    }
    
    return configs[intent] || { qualityThreshold: 0.7, timeout: 7000 }
  }

  private estimateResultCount(intent: SearchPlan['intent']): number {
    const counts = {
      research: 15,
      quick_lookup: 5,
      real_time: 10,
      academic: 8,
      code: 12
    }
    
    return counts[intent] || 10
  }

  private getQueryHash(query: string): string {
    return Buffer.from(query.toLowerCase().trim()).toString('base64')
  }
}

/**
 * 2. Provider Coordinator (Tactical Layer)
 * Routes queries to appropriate search engines with load balancing
 */
export class ProviderCoordinator {
  private engineHealth = new Map<string, boolean>()
  private engineLatency = new Map<string, number>()
  private requestCounts = new Map<string, number>()

  async executeSearchPlan(plan: SearchPlan): Promise<AsyncGenerator<SearchResult[], void, unknown>> {
    if (plan.strategy === 'parallel') {
      return this.executeParallelSearch(plan)
    } else {
      return this.executeSequentialSearch(plan)
    }
  }

  private async *executeParallelSearch(plan: SearchPlan): AsyncGenerator<SearchResult[], void, unknown> {
    const searchPromises = plan.engines.map(engine => 
      this.searchEngine(engine, plan.query, plan.timeout)
    )

    // Yield results as they arrive
    const settledPromises = await Promise.allSettled(searchPromises)
    
    for (const result of settledPromises) {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        yield result.value
      }
    }
  }

  private async *executeSequentialSearch(plan: SearchPlan): AsyncGenerator<SearchResult[], void, unknown> {
    let enhancedQuery = plan.query
    let previousResults: SearchResult[] = []

    for (const engine of plan.engines) {
      try {
        const results = await this.searchEngine(engine, enhancedQuery, plan.timeout)
        
        if (results.length > 0) {
          yield results
          previousResults = [...previousResults, ...results]
          enhancedQuery = this.enhanceQueryWithContext(plan.query, previousResults)
        }
      } catch (error) {
        console.error(`Engine ${engine} failed:`, error)
        // Continue with next engine
      }
    }
  }

  private async searchEngine(engine: string, query: string, timeout: number): Promise<SearchResult[]> {
    const startTime = Date.now()
    
    try {
      // Simulate engine-specific search logic
      const results = await this.performEngineSearch(engine, query, timeout)
      
      // Track performance
      this.engineLatency.set(engine, Date.now() - startTime)
      this.engineHealth.set(engine, true)
      this.requestCounts.set(engine, (this.requestCounts.get(engine) || 0) + 1)
      
      return results
    } catch (error) {
      this.engineHealth.set(engine, false)
      throw error
    }
  }

  private async performEngineSearch(engine: string, query: string, _timeout: number): Promise<SearchResult[]> {
    // This would integrate with actual search engines
    // For now, return mock results
    return [
      {
        id: `${engine}-${Date.now()}`,
        title: `Result from ${engine}`,
        content: `Search result for "${query}" from ${engine}`,
        url: `https://${engine}.com/result`,
        source: engine,
        relevanceScore: Math.random() * 0.4 + 0.6, // 0.6-1.0
        credibilityScore: Math.random() * 0.3 + 0.7, // 0.7-1.0
        freshnessScore: Math.random() * 0.5 + 0.5, // 0.5-1.0
        timestamp: new Date().toISOString()
      }
    ]
  }

  private enhanceQueryWithContext(originalQuery: string, previousResults: SearchResult[]): string {
    // Extract key terms from previous results to enhance query
    const keyTerms = previousResults
      .flatMap(result => result.title.split(' '))
      .filter(term => term.length > 3)
      .slice(0, 3)
    
    return keyTerms.length > 0 
      ? `${originalQuery} ${keyTerms.join(' ')}`
      : originalQuery
  }

  getEnginePerformance(): Record<string, { health: boolean; latency: number; requests: number }> {
    const performance: Record<string, { health: boolean; latency: number; requests: number }> = {}
    
    for (const [engine] of this.engineHealth) {
      performance[engine] = {
        health: this.engineHealth.get(engine) || false,
        latency: this.engineLatency.get(engine) || 0,
        requests: this.requestCounts.get(engine) || 0
      }
    }
    
    return performance
  }
}

/**
 * 3. Result Processor (Operational Layer)
 * Aggregates, deduplicates, and processes search results
 */
export class ResultProcessor {
  private resultCache = new Map<string, SearchResult[]>()

  async processResults(
    resultsStream: AsyncGenerator<SearchResult[], void, unknown>,
    plan: SearchPlan
  ): Promise<SearchResult[]> {
    const allResults: SearchResult[] = []
    const seenUrls = new Set<string>()

    for await (const batchResults of resultsStream) {
      // Deduplicate by URL
      const uniqueResults = batchResults.filter(result => {
        if (seenUrls.has(result.url)) return false
        seenUrls.add(result.url)
        return true
      })

      // Quality filter
      const qualityResults = uniqueResults.filter(
        result => this.calculateOverallQuality(result) >= plan.qualityThreshold
      )

      allResults.push(...qualityResults)
    }

    // Sort by overall quality score
    allResults.sort((a, b) => 
      this.calculateOverallQuality(b) - this.calculateOverallQuality(a)
    )

    // Cache results
    this.resultCache.set(this.getQueryHash(plan.query), allResults)

    return allResults.slice(0, plan.expectedResultCount || 10)
  }

  private calculateOverallQuality(result: SearchResult): number {
    // Weighted combination of quality metrics
    return (
      result.relevanceScore * 0.5 +
      result.credibilityScore * 0.3 +
      result.freshnessScore * 0.2
    )
  }

  private getQueryHash(query: string): string {
    return Buffer.from(query.toLowerCase().trim()).toString('base64')
  }

  getCachedResults(query: string): SearchResult[] | undefined {
    return this.resultCache.get(this.getQueryHash(query))
  }
}

/**
 * 4. Quality Verifier (Validation Layer)
 * Validates results and ensures quality standards
 */
export class QualityVerifier {
  validateResults(results: SearchResult[], plan: SearchPlan): {
    passed: boolean
    score: number
    issues: string[]
    recommendations: string[]
  } {
    const issues: string[] = []
    const recommendations: string[] = []
    
    // Check result count
    if (results.length === 0) {
      issues.push('No results returned')
      recommendations.push('Try broader search terms or different engines')
    }

    // Check quality distribution
    const avgQuality = results.reduce((sum, r) => 
      sum + this.calculateQuality(r), 0) / results.length
    
    if (avgQuality < plan.qualityThreshold) {
      issues.push(`Average quality ${avgQuality.toFixed(2)} below threshold ${plan.qualityThreshold}`)
      recommendations.push('Consider using additional search engines or refining query')
    }

    // Check source diversity
    const uniqueSources = new Set(results.map(r => r.source)).size
    if (uniqueSources < 2 && plan.engines.length > 1) {
      issues.push('Low source diversity')
      recommendations.push('Ensure multiple search engines are working properly')
    }

    // Check freshness for time-sensitive queries
    if (plan.intent === 'real_time') {
      const recentResults = results.filter(r => {
        const resultTime = new Date(r.timestamp).getTime()
        const dayAgo = Date.now() - (24 * 60 * 60 * 1000)
        return resultTime > dayAgo
      })
      
      if (recentResults.length < results.length * 0.7) {
        issues.push('Results not recent enough for real-time query')
        recommendations.push('Use more real-time focused search engines')
      }
    }

    return {
      passed: issues.length === 0,
      score: avgQuality,
      issues,
      recommendations
    }
  }

  private calculateQuality(result: SearchResult): number {
    return (
      result.relevanceScore * 0.5 +
      result.credibilityScore * 0.3 +
      result.freshnessScore * 0.2
    )
  }
}

/**
 * 5. Adaptive Optimizer (Learning Layer)
 * Learns from search performance and optimizes strategies
 */
export class AdaptiveOptimizer {
  private searchHistory: Array<{
    plan: SearchPlan
    results: SearchResult[]
    metrics: HALOMetrics
    userFeedback?: number
  }> = []

  recordSearchExecution(
    plan: SearchPlan,
    results: SearchResult[],
    metrics: HALOMetrics,
    userFeedback?: number
  ) {
    this.searchHistory.push({
      plan,
      results,
      metrics,
      userFeedback
    })

    // Keep only recent history (last 1000 searches)
    if (this.searchHistory.length > 1000) {
      this.searchHistory = this.searchHistory.slice(-1000)
    }
  }

  optimizeForQuery(query: string): Partial<SearchPlan> {
    const similarSearches = this.findSimilarSearches(query)
    
    if (similarSearches.length === 0) {
      return {} // No optimization available
    }

    // Find best performing strategy
    const bestSearch = similarSearches.reduce((best, current) => 
      current.metrics.qualityScore > best.metrics.qualityScore ? current : best
    )

    return {
      engines: bestSearch.plan.engines,
      strategy: bestSearch.plan.strategy,
      qualityThreshold: bestSearch.plan.qualityThreshold,
      timeout: Math.min(bestSearch.plan.timeout, bestSearch.metrics.totalTime * 1.2)
    }
  }

  private findSimilarSearches(query: string): typeof this.searchHistory {
    const queryWords = query.toLowerCase().split(' ')
    
    return this.searchHistory.filter(search => {
      const searchWords = search.plan.query.toLowerCase().split(' ')
      const commonWords = queryWords.filter(word => searchWords.includes(word))
      return commonWords.length >= Math.min(queryWords.length, searchWords.length) * 0.5
    })
  }

  getPerformanceInsights(): {
    bestEngines: string[]
    avgResponseTime: number
    successRate: number
    recommendations: string[]
  } {
    if (this.searchHistory.length === 0) {
      return {
        bestEngines: [],
        avgResponseTime: 0,
        successRate: 0,
        recommendations: ['No search history available']
      }
    }

    // Calculate engine performance
    const engineScores = new Map<string, number[]>()
    
    for (const search of this.searchHistory) {
      for (const engine of search.plan.engines) {
        if (!engineScores.has(engine)) {
          engineScores.set(engine, [])
        }
        engineScores.get(engine)!.push(search.metrics.qualityScore)
      }
    }

    const bestEngines = Array.from(engineScores.entries())
      .map(([engine, scores]) => ({
        engine,
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 3)
      .map(item => item.engine)

    const avgResponseTime = this.searchHistory.reduce((sum, search) => 
      sum + search.metrics.totalTime, 0) / this.searchHistory.length

    const successRate = this.searchHistory.filter(search => 
      search.metrics.successRate > 0.8).length / this.searchHistory.length

    const recommendations: string[] = []
    if (avgResponseTime > 8000) {
      recommendations.push('Consider optimizing timeout settings for faster responses')
    }
    if (successRate < 0.9) {
      recommendations.push('Review engine selection strategy to improve success rate')
    }

    return {
      bestEngines,
      avgResponseTime,
      successRate,
      recommendations
    }
  }
}

/**
 * Main HALO Search Orchestrator
 * Coordinates all 5 layers for intelligent search execution
 */
export class HALOSearchOrchestrator {
  private planner = new SearchPlanner()
  private coordinator = new ProviderCoordinator()
  private processor = new ResultProcessor()
  private verifier = new QualityVerifier()
  private optimizer = new AdaptiveOptimizer()

  async executeSearch(query: string): Promise<{
    results: SearchResult[]
    metrics: HALOMetrics
    validation: ReturnType<QualityVerifier['validateResults']>
    plan: SearchPlan
  }> {
    const startTime = Date.now()
    
    // Layer 1: Planning
    const planStart = Date.now()
    let plan = this.planner.analyzeQuery(query)
    
    // Apply optimization from learning layer
    const optimization = this.optimizer.optimizeForQuery(query)
    plan = { ...plan, ...optimization }
    
    const planningTime = Date.now() - planStart

    // Layer 2: Execution
    const execStart = Date.now()
    const resultsStream = await this.coordinator.executeSearchPlan(plan)
    const executionTime = Date.now() - execStart

    // Layer 3: Processing
    const processStart = Date.now()
    const results = await this.processor.processResults(resultsStream, plan)
    const processingTime = Date.now() - processStart

    // Layer 4: Verification
    const verifyStart = Date.now()
    const validation = this.verifier.validateResults(results, plan)
    const verificationTime = Date.now() - verifyStart

    const totalTime = Date.now() - startTime
    const enginePerformance = this.coordinator.getEnginePerformance()

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
      )
    }

    // Layer 5: Learning
    this.optimizer.recordSearchExecution(plan, results, metrics)

    return {
      results,
      metrics,
      validation,
      plan
    }
  }

  getSystemStatus() {
    const insights = this.optimizer.getPerformanceInsights()
    const enginePerformance = this.coordinator.getEnginePerformance()

    return {
      performance: insights,
      engines: enginePerformance,
      timestamp: new Date().toISOString()
    }
  }
}

// Export singleton instance
export const haloOrchestrator = new HALOSearchOrchestrator()