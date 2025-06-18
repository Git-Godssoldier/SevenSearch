/**
 * Planning Search System
 * 
 * This module enables dynamic search capabilities during the planning phase,
 * allowing the workflow to gather information necessary for planning and strategy.
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import { SearchStrategy } from './dynamic-orchestration';
import { TaskManager, TaskStatus, TaskPriority } from './task-management';

// Lightweight search result schema
export const PlanningSearchResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  snippet: z.string().optional(),
  source: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  relevance: z.number().min(0).max(1).optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

export type PlanningSearchResult = z.infer<typeof PlanningSearchResultSchema>;

// Planning search events
export enum PlanningSearchEventType {
  SEARCH_STARTED = 'planning_search_started',
  SEARCH_COMPLETED = 'planning_search_completed',
  SEARCH_FAILED = 'planning_search_failed',
  INSIGHT_DISCOVERED = 'planning_insight_discovered',
  RESOURCES_IDENTIFIED = 'planning_resources_identified',
  SEARCH_STRATEGY_RECOMMENDED = 'planning_search_strategy_recommended'
}

// Planning query type
export enum PlanningQueryType {
  DOMAIN_EXPLORATION = 'domain_exploration',
  TERM_DEFINITION = 'term_definition',
  RELATED_CONCEPTS = 'related_concepts',
  STRATEGY_RESEARCH = 'strategy_research',
  SOURCE_CREDIBILITY = 'source_credibility',
  TIME_SENSITIVITY = 'time_sensitivity',
  COMPLEXITY_ASSESSMENT = 'complexity_assessment'
}

// Planning insight type
export enum InsightType {
  DOMAIN_KNOWLEDGE = 'domain_knowledge',
  KEY_TERMINOLOGY = 'key_terminology',
  RESOURCE_SUGGESTION = 'resource_suggestion',
  STRATEGY_SIGNAL = 'strategy_signal',
  SEARCH_CONSTRAINT = 'search_constraint',
  WARNING = 'warning'
}

// Planning insight schema
export const PlanningInsightSchema = z.object({
  type: z.enum([
    InsightType.DOMAIN_KNOWLEDGE,
    InsightType.KEY_TERMINOLOGY,
    InsightType.RESOURCE_SUGGESTION,
    InsightType.STRATEGY_SIGNAL,
    InsightType.SEARCH_CONSTRAINT,
    InsightType.WARNING
  ]),
  content: z.string(),
  sourceUrl: z.string().url().optional(),
  confidence: z.number().min(0).max(1).optional(),
  associatedStrategy: z.nativeEnum(SearchStrategy).optional(),
  suggestedTerms: z.array(z.string()).optional(),
  domainRelevance: z.array(z.string()).optional(),
  timeConstraint: z.string().optional()
});

export type PlanningInsight = z.infer<typeof PlanningInsightSchema>;

/**
 * Planning Search Manager
 * 
 * Manages the search operations during the planning phase to inform
 * the planning process with dynamic information.
 */
export class PlanningSearchManager {
  private emitter: EventEmitter;
  private taskManager: TaskManager;
  private searchId: string;
  private userId: string;
  private insights: PlanningInsight[] = [];
  private strategies: Map<SearchStrategy, number> = new Map();
  private queryTermCache: Map<string, PlanningSearchResult[]> = new Map();
  private searchProviders: Map<string, any> = new Map();
  
  /**
   * Create a new PlanningSearchManager
   * @param searchId Search ID
   * @param userId User ID
   * @param taskManager Task manager instance
   * @param emitter Optional event emitter
   */
  constructor(
    searchId: string,
    userId: string,
    taskManager: TaskManager,
    emitter?: EventEmitter
  ) {
    this.searchId = searchId;
    this.userId = userId;
    this.taskManager = taskManager;
    this.emitter = emitter || new EventEmitter();
    
    // Initialize search strategy scores
    Object.values(SearchStrategy).forEach(strategy => {
      this.strategies.set(strategy, 0);
    });
  }
  
  /**
   * Register a search provider
   * @param name Provider name
   * @param provider Provider implementation
   */
  registerSearchProvider(name: string, provider: any): void {
    this.searchProviders.set(name, provider);
  }
  
  /**
   * Check if a provider is registered
   * @param name Provider name
   */
  hasProvider(name: string): boolean {
    return this.searchProviders.has(name);
  }
  
  /**
   * Execute a planning search query
   * @param query Search query
   * @param queryType Type of planning query
   * @param providerNames Optional array of provider names to use (otherwise uses all)
   * @returns Array of search results
   */
  async search(
    query: string,
    queryType: PlanningQueryType,
    providerNames?: string[]
  ): Promise<PlanningSearchResult[]> {
    // Check cache first
    const cacheKey = `${queryType}:${query}`;
    if (this.queryTermCache.has(cacheKey)) {
      return this.queryTermCache.get(cacheKey) || [];
    }
    
    // Determine which providers to use
    const providers = providerNames 
      ? providerNames.map(name => this.searchProviders.get(name)).filter(Boolean)
      : Array.from(this.searchProviders.values());
    
    if (providers.length === 0) {
      throw new Error('No search providers available');
    }
    
    // Emit search started event
    this.emitEvent(PlanningSearchEventType.SEARCH_STARTED, {
      query,
      queryType,
      providers: providers.length,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Create task for this search
      await this.taskManager.createTask({
        searchId: this.searchId,
        userId: this.userId,
        title: `Research ${queryType}: ${query}`,
        description: `Planning search for information about "${query}" (${queryType})`,
        priority: TaskPriority.MEDIUM,
        tags: ['planning', 'research', queryType]
      });
      
      // Execute search with all providers in parallel
      const searchPromises = providers.map(async provider => {
        try {
          if (typeof provider.search !== 'function') {
            return [];
          }
          return await provider.search(query, { queryType, limit: 5 });
        } catch (error) {
          console.error(`[PlanningSearchManager] Provider error:`, error);
          return [];
        }
      });
      
      const searchResults = await Promise.all(searchPromises);
      
      // Flatten and validate results
      const results: PlanningSearchResult[] = [];
      for (const providerResults of searchResults) {
        for (const result of providerResults) {
          try {
            const validResult = PlanningSearchResultSchema.parse(result);
            results.push(validResult);
          } catch (error) {
            console.warn('[PlanningSearchManager] Invalid result:', error);
          }
        }
      }
      
      // Deduplicate results by URL
      const uniqueResults = results.filter((result, index, self) => {
        return index === self.findIndex(r => r.url === result.url);
      });
      
      // Cache the results
      this.queryTermCache.set(cacheKey, uniqueResults);
      
      // Extract insights from results based on query type
      await this.extractInsights(uniqueResults, query, queryType);
      
      // Emit search completed event
      this.emitEvent(PlanningSearchEventType.SEARCH_COMPLETED, {
        query,
        queryType,
        resultCount: uniqueResults.length,
        timestamp: new Date().toISOString()
      });
      
      return uniqueResults;
    } catch (error) {
      // Emit search failed event
      this.emitEvent(PlanningSearchEventType.SEARCH_FAILED, {
        query,
        queryType,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
      
      console.error('[PlanningSearchManager] Search error:', error);
      return [];
    }
  }
  
  /**
   * Extract insights from search results
   * @param results Search results
   * @param query Original query
   * @param queryType Type of planning query
   */
  private async extractInsights(
    results: PlanningSearchResult[],
    query: string,
    queryType: PlanningQueryType
  ): Promise<void> {
    if (results.length === 0) return;
    
    // Extract insights based on query type
    switch (queryType) {
      case PlanningQueryType.DOMAIN_EXPLORATION:
        await this.extractDomainInsights(results, query);
        break;
        
      case PlanningQueryType.TERM_DEFINITION:
        await this.extractTerminologyInsights(results, query);
        break;
        
      case PlanningQueryType.RELATED_CONCEPTS:
        await this.extractRelatedConceptsInsights(results, query);
        break;
        
      case PlanningQueryType.STRATEGY_RESEARCH:
        await this.extractStrategyInsights(results, query);
        break;
        
      case PlanningQueryType.SOURCE_CREDIBILITY:
        await this.extractSourceCredibilityInsights(results, query);
        break;
        
      case PlanningQueryType.TIME_SENSITIVITY:
        await this.extractTimeSensitivityInsights(results, query);
        break;
        
      case PlanningQueryType.COMPLEXITY_ASSESSMENT:
        await this.extractComplexityInsights(results, query);
        break;
    }
  }
  
  /**
   * Extract domain-specific insights
   */
  private async extractDomainInsights(results: PlanningSearchResult[], query: string): Promise<void> {
    // Analyze domains from URLs
    const domains = results.map(r => {
      try {
        return new URL(r.url).hostname;
      } catch {
        return '';
      }
    }).filter(Boolean);
    
    // Count domain types
    const domainTypes = {
      edu: domains.filter(d => d.endsWith('.edu')).length,
      gov: domains.filter(d => d.endsWith('.gov')).length,
      org: domains.filter(d => d.endsWith('.org')).length,
      com: domains.filter(d => d.endsWith('.com')).length,
      io: domains.filter(d => d.endsWith('.io')).length,
      dev: domains.filter(d => d.endsWith('.dev')).length,
      ai: domains.filter(d => d.match(/\.ai($|\/)/)).length
    };
    
    // Determine domain focus
    const topDomains = Object.entries(domainTypes)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, count]) => count > 0)
      .map(([domain]) => domain);
    
    if (topDomains.length > 0) {
      // Academic focus
      if (domainTypes.edu > 0 || domainTypes.gov > 0) {
        this.addStrategyScore(SearchStrategy.ACADEMIC, 2);
        
        this.addInsight({
          type: InsightType.DOMAIN_KNOWLEDGE,
          content: `Query "${query}" appears to have academic or governmental relevance with ${domainTypes.edu} .edu and ${domainTypes.gov} .gov domains.`,
          confidence: 0.8,
          associatedStrategy: SearchStrategy.ACADEMIC,
          domainRelevance: ['academic', 'governmental', 'educational']
        });
      }
      
      // Technical focus
      if (domainTypes.io > 0 || domainTypes.dev > 0 || domainTypes.ai > 0) {
        this.addStrategyScore(SearchStrategy.TECHNICAL, 2);
        
        this.addInsight({
          type: InsightType.DOMAIN_KNOWLEDGE,
          content: `Query "${query}" appears to have technical relevance with ${domainTypes.io + domainTypes.dev + domainTypes.ai} technical domain results.`,
          confidence: 0.8,
          associatedStrategy: SearchStrategy.TECHNICAL,
          domainRelevance: ['technical', 'development', 'technology']
        });
      }
    }
  }
  
  /**
   * Extract terminology insights
   */
  private async extractTerminologyInsights(results: PlanningSearchResult[], query: string): Promise<void> {
    // Extract definitions or explanations from snippets
    const definitions = results
      .filter(r => r.snippet && r.snippet.includes(query))
      .map(r => r.snippet)
      .filter(Boolean)
      .slice(0, 2);
    
    if (definitions.length > 0) {
      this.addInsight({
        type: InsightType.KEY_TERMINOLOGY,
        content: `Definition for "${query}": ${definitions[0]}`,
        confidence: 0.7,
        suggestedTerms: [query]
      });
    }
  }
  
  /**
   * Extract related concepts insights
   */
  private async extractRelatedConceptsInsights(results: PlanningSearchResult[], query: string): Promise<void> {
    // Extract potential related terms from titles and snippets
    const terms = new Set<string>();
    
    results.forEach(result => {
      const text = `${result.title} ${result.snippet || ''}`;
      
      // Simple extraction of capitalized phrases (could be improved with NLP)
      const matches = text.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/g) || [];
      matches.forEach(match => {
        if (match !== query && match.length > 3) {
          terms.add(match);
        }
      });
    });
    
    if (terms.size > 0) {
      const relatedTerms = Array.from(terms).slice(0, 5);
      
      this.addInsight({
        type: InsightType.RESOURCE_SUGGESTION,
        content: `Related terms for "${query}": ${relatedTerms.join(', ')}`,
        confidence: 0.6,
        suggestedTerms: relatedTerms
      });
    }
  }
  
  /**
   * Extract strategy insights
   */
  private async extractStrategyInsights(results: PlanningSearchResult[], query: string): Promise<void> {
    // Look for signals about complexity
    const complexitySignals = {
      high: 0,
      medium: 0,
      low: 0
    };
    
    // Simple heuristics for complexity assessment
    results.forEach(result => {
      const text = `${result.title} ${result.snippet || ''}`.toLowerCase();
      
      // High complexity signals
      if (text.includes('complex') || 
          text.includes('advanced') || 
          text.includes('specialist') ||
          text.includes('academic') ||
          text.includes('technical')) {
        complexitySignals.high += 1;
      }
      
      // Medium complexity signals
      else if (text.includes('guide') ||
               text.includes('how to') ||
               text.includes('tutorial') ||
               text.includes('overview')) {
        complexitySignals.medium += 1;
      }
      
      // Low complexity signals
      else if (text.includes('simple') ||
               text.includes('basic') ||
               text.includes('introduction') ||
               text.includes('beginner')) {
        complexitySignals.low += 1;
      }
    });
    
    // Determine complexity level
    const maxComplexity = Object.entries(complexitySignals)
      .sort((a, b) => b[1] - a[1])[0];
    
    if (maxComplexity[1] > 0) {
      // Adjust strategy based on complexity
      if (maxComplexity[0] === 'high') {
        this.addStrategyScore(SearchStrategy.DEEP_RESEARCH, 3);
        this.addStrategyScore(SearchStrategy.ACADEMIC, 2);
        
        this.addInsight({
          type: InsightType.STRATEGY_SIGNAL,
          content: `Query "${query}" appears to be highly complex, suggesting in-depth research is needed.`,
          confidence: 0.7,
          associatedStrategy: SearchStrategy.DEEP_RESEARCH
        });
      } else if (maxComplexity[0] === 'medium') {
        this.addStrategyScore(SearchStrategy.BALANCED, 2);
        
        this.addInsight({
          type: InsightType.STRATEGY_SIGNAL,
          content: `Query "${query}" appears to be moderately complex, suggesting a balanced approach.`,
          confidence: 0.7,
          associatedStrategy: SearchStrategy.BALANCED
        });
      } else {
        this.addStrategyScore(SearchStrategy.STANDARD, 2);
        
        this.addInsight({
          type: InsightType.STRATEGY_SIGNAL,
          content: `Query "${query}" appears to be straightforward, suggesting a standard approach.`,
          confidence: 0.7,
          associatedStrategy: SearchStrategy.STANDARD
        });
      }
    }
  }
  
  /**
   * Extract source credibility insights
   */
  private async extractSourceCredibilityInsights(results: PlanningSearchResult[], query: string): Promise<void> {
    // Identify high credibility sources
    const credibleDomains = results
      .map(r => {
        try {
          return new URL(r.url).hostname;
        } catch {
          return '';
        }
      })
      .filter(domain => 
        domain.endsWith('.edu') || 
        domain.endsWith('.gov') || 
        domain.endsWith('.org') ||
        domain.includes('wikipedia.org') ||
        domain.includes('github.com')
      );
    
    if (credibleDomains.length > 0) {
      const uniqueDomains = [...new Set(credibleDomains)];
      
      this.addInsight({
        type: InsightType.RESOURCE_SUGGESTION,
        content: `Credible sources for "${query}": ${uniqueDomains.join(', ')}`,
        confidence: 0.8,
        domainRelevance: uniqueDomains
      });
      
      // Suggest academic strategy if many credible sources
      if (uniqueDomains.length >= 2) {
        this.addStrategyScore(SearchStrategy.ACADEMIC, 2);
      }
    }
  }
  
  /**
   * Extract time sensitivity insights
   */
  private async extractTimeSensitivityInsights(results: PlanningSearchResult[], query: string): Promise<void> {
    // Look for date references in snippets
    const dateReferences = [];
    const currentYear = new Date().getFullYear();
    
    for (const result of results) {
      const text = `${result.title} ${result.snippet || ''}`;
      
      // Match years in the text
      const yearMatches = text.match(/\b(20\d\d)\b/g) || [];
      
      // Extract unique years
      for (const year of yearMatches) {
        const yearNum = parseInt(year, 10);
        if (yearNum >= currentYear - 3 && yearNum <= currentYear) {
          dateReferences.push(year);
        }
      }
      
      // Look for terms suggesting recency
      if (text.toLowerCase().match(/\b(recent|latest|new|current|update|today|week|month)\b/)) {
        dateReferences.push('recent');
      }
    }
    
    // If many recent references, suggest recent events strategy
    if (dateReferences.length >= 3) {
      this.addStrategyScore(SearchStrategy.RECENT_EVENTS, 3);
      
      this.addInsight({
        type: InsightType.SEARCH_CONSTRAINT,
        content: `Query "${query}" appears to be time-sensitive with ${dateReferences.length} recent date references.`,
        confidence: 0.8,
        associatedStrategy: SearchStrategy.RECENT_EVENTS,
        timeConstraint: 'recent'
      });
    }
  }
  
  /**
   * Extract complexity insights
   */
  private async extractComplexityInsights(results: PlanningSearchResult[], query: string): Promise<void> {
    // Assess page content complexity from snippets
    let totalWordCount = 0;
    let technicalTermCount = 0;
    
    // Simple technical term detection
    const technicalTerms = [
      'algorithm', 'framework', 'library', 'implementation', 'architecture',
      'protocol', 'infrastructure', 'database', 'deployment', 'integration',
      'configuration', 'optimization', 'authentication', 'encryption', 'compiler',
      'runtime', 'dependency', 'interface', 'specification', 'documentation'
    ];
    
    results.forEach(result => {
      if (result.snippet) {
        // Count words
        const words = result.snippet.split(/\s+/);
        totalWordCount += words.length;
        
        // Count technical terms
        technicalTerms.forEach(term => {
          const regex = new RegExp(`\\b${term}\\b`, 'ig');
          const matches = result.snippet.match(regex);
          if (matches) {
            technicalTermCount += matches.length;
          }
        });
      }
    });
    
    // Calculate technical density
    const technicalDensity = totalWordCount > 0 ? technicalTermCount / totalWordCount : 0;
    
    if (technicalDensity > 0.05) {
      this.addStrategyScore(SearchStrategy.TECHNICAL, 3);
      
      this.addInsight({
        type: InsightType.STRATEGY_SIGNAL,
        content: `Query "${query}" has high technical content density (${(technicalDensity * 100).toFixed(1)}%), suggesting a technical approach.`,
        confidence: 0.8,
        associatedStrategy: SearchStrategy.TECHNICAL
      });
    }
  }
  
  /**
   * Add a strategy score
   * @param strategy The strategy to score
   * @param points Points to add
   */
  private addStrategyScore(strategy: SearchStrategy, points: number): void {
    const currentScore = this.strategies.get(strategy) || 0;
    this.strategies.set(strategy, currentScore + points);
    
    // Emit event if this strategy becomes the top recommendation
    const topStrategy = this.getRecommendedStrategy();
    if (topStrategy === strategy) {
      this.emitEvent(PlanningSearchEventType.SEARCH_STRATEGY_RECOMMENDED, {
        strategy,
        score: currentScore + points,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Add an insight
   * @param insight The insight to add
   */
  private addInsight(insight: PlanningInsight): void {
    // Validate insight
    try {
      const validInsight = PlanningInsightSchema.parse(insight);
      this.insights.push(validInsight);
      
      // Emit insight discovered event
      this.emitEvent(PlanningSearchEventType.INSIGHT_DISCOVERED, {
        insightType: validInsight.type,
        content: validInsight.content,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn('[PlanningSearchManager] Invalid insight:', error);
    }
  }
  
  /**
   * Get the recommended search strategy based on scores
   * @returns The recommended search strategy
   */
  getRecommendedStrategy(): SearchStrategy {
    // Find strategy with highest score
    let topStrategy = SearchStrategy.STANDARD;
    let topScore = 0;
    
    for (const [strategy, score] of this.strategies.entries()) {
      if (score > topScore) {
        topScore = score;
        topStrategy = strategy;
      }
    }
    
    return topStrategy;
  }
  
  /**
   * Get all insights
   * @returns Array of all insights
   */
  getAllInsights(): PlanningInsight[] {
    return [...this.insights];
  }
  
  /**
   * Get insights of a specific type
   * @param type Insight type
   * @returns Array of insights of the specified type
   */
  getInsightsByType(type: InsightType): PlanningInsight[] {
    return this.insights.filter(insight => insight.type === type);
  }
  
  /**
   * Get insights related to a specific search strategy
   * @param strategy Search strategy
   * @returns Array of insights related to the strategy
   */
  getInsightsByStrategy(strategy: SearchStrategy): PlanningInsight[] {
    return this.insights.filter(insight => insight.associatedStrategy === strategy);
  }
  
  /**
   * Get all strategy scores
   * @returns Map of strategies to scores
   */
  getStrategyScores(): Map<SearchStrategy, number> {
    return new Map(this.strategies);
  }
  
  /**
   * Clear search cache and insights
   */
  clear(): void {
    this.queryTermCache.clear();
    this.insights = [];
    
    // Reset strategy scores
    Object.values(SearchStrategy).forEach(strategy => {
      this.strategies.set(strategy, 0);
    });
  }
  
  /**
   * Emit a planning search event
   * @param eventType Type of event to emit
   * @param payload Event payload
   */
  private emitEvent(eventType: PlanningSearchEventType, payload: any): void {
    this.emitter.emit(eventType, {
      type: eventType,
      timestamp: new Date().toISOString(),
      ...payload
    });
  }
  
  /**
   * Subscribe to planning search events
   * @param eventType Type of event to subscribe to
   * @param handler Event handler function
   * @returns Function to unsubscribe
   */
  subscribeToEvent(eventType: PlanningSearchEventType, handler: (event: any) => void): () => void {
    this.emitter.on(eventType, handler);
    return () => this.emitter.off(eventType, handler);
  }
  
  /**
   * Subscribe to all planning search events
   * @param handler Event handler function
   * @returns Function to unsubscribe
   */
  subscribeToAllEvents(handler: (event: any) => void): () => void {
    const eventTypes = Object.values(PlanningSearchEventType);
    
    // Subscribe to all event types
    eventTypes.forEach(type => {
      this.emitter.on(type, handler);
    });
    
    // Return unsubscribe function
    return () => {
      eventTypes.forEach(type => {
        this.emitter.off(type, handler);
      });
    };
  }
}

/**
 * Create a planning search manager
 * @param searchId Search ID
 * @param userId User ID
 * @param taskManager Task manager instance
 * @param emitter Optional event emitter
 * @returns PlanningSearchManager instance
 */
export function createPlanningSearchManager(
  searchId: string,
  userId: string,
  taskManager: TaskManager,
  emitter?: EventEmitter
): PlanningSearchManager {
  return new PlanningSearchManager(searchId, userId, taskManager, emitter);
}

export default createPlanningSearchManager;