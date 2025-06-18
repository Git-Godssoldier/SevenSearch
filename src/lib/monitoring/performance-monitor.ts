/**
 * Enhanced Performance Monitoring System
 * 
 * Implements enterprise-grade monitoring patterns from Poseidon system prompt:
 * - Real-time metrics collection
 * - Performance optimization
 * - Quality scoring
 * - Alert management
 */

import { z } from 'zod'

// Performance metric schemas
export const PerformanceMetricSchema = z.object({
  timestamp: z.string(),
  operation: z.string(),
  duration: z.number(),
  success: z.boolean(),
  qualityScore: z.number().min(0).max(1).optional(),
  engineUsed: z.string().optional(),
  resultCount: z.number().optional(),
  errorType: z.string().optional(),
  userId: z.string().optional()
})

export const SystemHealthSchema = z.object({
  cpu: z.number(),
  memory: z.number(),
  responseTime: z.number(),
  errorRate: z.number(),
  throughput: z.number(),
  timestamp: z.string()
})

export type PerformanceMetric = z.infer<typeof PerformanceMetricSchema>
export type SystemHealth = z.infer<typeof SystemHealthSchema>

interface AlertThresholds {
  responseTime: number // ms
  errorRate: number // percentage
  qualityScore: number // 0-1
  memoryUsage: number // percentage
}

/**
 * Real-time Performance Monitor
 * Tracks system performance with <23ms target response times
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private healthHistory: SystemHealth[] = []
  private alertThresholds: AlertThresholds = {
    responseTime: 50, // ms - targeting <23ms average
    errorRate: 0.05, // 5%
    qualityScore: 0.7, // 70%
    memoryUsage: 85 // 85%
  }
  private alerts: Array<{
    id: string
    type: string
    message: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    timestamp: string
    resolved: boolean
  }> = []

  /**
   * Record a performance metric
   */
  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    const timestampedMetric: PerformanceMetric = {
      ...metric,
      timestamp: new Date().toISOString()
    }

    this.metrics.push(timestampedMetric)
    
    // Keep only last 10000 metrics for performance
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-10000)
    }

    // Check for performance alerts
    this.checkPerformanceAlerts(timestampedMetric)
  }

  /**
   * Record system health metrics
   */
  recordSystemHealth(health: Omit<SystemHealth, 'timestamp'>): void {
    const timestampedHealth: SystemHealth = {
      ...health,
      timestamp: new Date().toISOString()
    }

    this.healthHistory.push(timestampedHealth)
    
    // Keep only last 1000 health records
    if (this.healthHistory.length > 1000) {
      this.healthHistory = this.healthHistory.slice(-1000)
    }

    // Check for system alerts
    this.checkSystemAlerts(timestampedHealth)
  }

  /**
   * Get current performance summary
   */
  getPerformanceSummary(timeWindowMs: number = 300000): {
    avgResponseTime: number
    successRate: number
    avgQualityScore: number
    requestCount: number
    enginePerformance: Record<string, {
      avgResponseTime: number
      successRate: number
      requestCount: number
    }>
    targetMet: {
      responseTime: boolean
      successRate: boolean
      qualityScore: boolean
    }
  } {
    const cutoffTime = Date.now() - timeWindowMs
    const recentMetrics = this.metrics.filter(m => 
      new Date(m.timestamp).getTime() > cutoffTime
    )

    if (recentMetrics.length === 0) {
      return {
        avgResponseTime: 0,
        successRate: 0,
        avgQualityScore: 0,
        requestCount: 0,
        enginePerformance: {},
        targetMet: {
          responseTime: false,
          successRate: false,
          qualityScore: false
        }
      }
    }

    // Calculate overall metrics
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length
    const successRate = recentMetrics.filter(m => m.success).length / recentMetrics.length
    const qualityMetrics = recentMetrics.filter(m => m.qualityScore !== undefined)
    const avgQualityScore = qualityMetrics.length > 0 
      ? qualityMetrics.reduce((sum, m) => sum + (m.qualityScore || 0), 0) / qualityMetrics.length
      : 0

    // Calculate engine-specific performance
    const enginePerformance: Record<string, {
      avgResponseTime: number
      successRate: number
      requestCount: number
    }> = {}

    const engineMetrics = recentMetrics.filter(m => m.engineUsed)
    const engineGroups = this.groupBy(engineMetrics, m => m.engineUsed!)

    for (const [engine, metrics] of Object.entries(engineGroups)) {
      enginePerformance[engine] = {
        avgResponseTime: metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length,
        successRate: metrics.filter(m => m.success).length / metrics.length,
        requestCount: metrics.length
      }
    }

    return {
      avgResponseTime,
      successRate,
      avgQualityScore,
      requestCount: recentMetrics.length,
      enginePerformance,
      targetMet: {
        responseTime: avgResponseTime <= this.alertThresholds.responseTime,
        successRate: successRate >= (1 - this.alertThresholds.errorRate),
        qualityScore: avgQualityScore >= this.alertThresholds.qualityScore
      }
    }
  }

  /**
   * Get system health status
   */
  getSystemHealth(): SystemHealth | null {
    return this.healthHistory.length > 0 
      ? this.healthHistory[this.healthHistory.length - 1]
      : null
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): typeof this.alerts {
    return this.alerts.filter(alert => !alert.resolved)
  }

  /**
   * Get performance recommendations
   */
  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = []
    const summary = this.getPerformanceSummary()

    if (!summary.targetMet.responseTime) {
      recommendations.push(
        `Response time ${summary.avgResponseTime.toFixed(1)}ms exceeds target ${this.alertThresholds.responseTime}ms. Consider optimizing search engine selection or implementing caching.`
      )
    }

    if (!summary.targetMet.successRate) {
      recommendations.push(
        `Success rate ${(summary.successRate * 100).toFixed(1)}% below target ${((1 - this.alertThresholds.errorRate) * 100).toFixed(1)}%. Review error patterns and implement better fallback strategies.`
      )
    }

    if (!summary.targetMet.qualityScore) {
      recommendations.push(
        `Quality score ${(summary.avgQualityScore * 100).toFixed(1)}% below target ${(this.alertThresholds.qualityScore * 100).toFixed(1)}%. Consider adjusting search algorithms or quality thresholds.`
      )
    }

    // Engine-specific recommendations
    for (const [engine, perf] of Object.entries(summary.enginePerformance)) {
      if (perf.avgResponseTime > this.alertThresholds.responseTime * 2) {
        recommendations.push(
          `Engine ${engine} has high latency (${perf.avgResponseTime.toFixed(1)}ms). Consider timeout optimization or provider evaluation.`
        )
      }
      if (perf.successRate < 0.8) {
        recommendations.push(
          `Engine ${engine} has low success rate (${(perf.successRate * 100).toFixed(1)}%). Review API configuration and error handling.`
        )
      }
    }

    return recommendations
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(format: 'json' | 'prometheus' = 'json'): string {
    if (format === 'prometheus') {
      return this.formatPrometheusMetrics()
    }

    const summary = this.getPerformanceSummary()
    const health = this.getSystemHealth()
    const alerts = this.getActiveAlerts()

    return JSON.stringify({
      timestamp: new Date().toISOString(),
      performance: summary,
      health,
      alerts,
      recommendations: this.getPerformanceRecommendations()
    }, null, 2)
  }

  private checkPerformanceAlerts(metric: PerformanceMetric): void {
    // Response time alert
    if (metric.duration > this.alertThresholds.responseTime) {
      this.createAlert(
        'high_response_time',
        `High response time: ${metric.duration}ms for operation ${metric.operation}`,
        metric.duration > this.alertThresholds.responseTime * 2 ? 'high' : 'medium'
      )
    }

    // Quality score alert
    if (metric.qualityScore !== undefined && metric.qualityScore < this.alertThresholds.qualityScore) {
      this.createAlert(
        'low_quality_score',
        `Low quality score: ${(metric.qualityScore * 100).toFixed(1)}% for operation ${metric.operation}`,
        metric.qualityScore < this.alertThresholds.qualityScore * 0.5 ? 'high' : 'medium'
      )
    }

    // Error alert
    if (!metric.success) {
      this.createAlert(
        'operation_failure',
        `Operation failed: ${metric.operation} - ${metric.errorType || 'Unknown error'}`,
        'medium'
      )
    }
  }

  private checkSystemAlerts(health: SystemHealth): void {
    // Memory usage alert
    if (health.memory > this.alertThresholds.memoryUsage) {
      this.createAlert(
        'high_memory_usage',
        `High memory usage: ${health.memory.toFixed(1)}%`,
        health.memory > 95 ? 'critical' : 'high'
      )
    }

    // Error rate alert
    if (health.errorRate > this.alertThresholds.errorRate) {
      this.createAlert(
        'high_error_rate',
        `High error rate: ${(health.errorRate * 100).toFixed(1)}%`,
        health.errorRate > this.alertThresholds.errorRate * 2 ? 'high' : 'medium'
      )
    }
  }

  private createAlert(
    type: string,
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): void {
    // Check if similar alert already exists
    const existingAlert = this.alerts.find(alert => 
      alert.type === type && !alert.resolved
    )

    if (existingAlert) {
      return // Don't create duplicate alerts
    }

    this.alerts.push({
      id: `${type}-${Date.now()}`,
      type,
      message,
      severity,
      timestamp: new Date().toISOString(),
      resolved: false
    })

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100)
    }
  }

  private formatPrometheusMetrics(): string {
    const summary = this.getPerformanceSummary()
    const health = this.getSystemHealth()
    
    let output = ''
    
    // Response time metric
    output += `# HELP sevensearch_response_time_ms Average response time in milliseconds\n`
    output += `# TYPE sevensearch_response_time_ms gauge\n`
    output += `sevensearch_response_time_ms ${summary.avgResponseTime}\n\n`
    
    // Success rate metric
    output += `# HELP sevensearch_success_rate Success rate as a decimal\n`
    output += `# TYPE sevensearch_success_rate gauge\n`
    output += `sevensearch_success_rate ${summary.successRate}\n\n`
    
    // Quality score metric
    output += `# HELP sevensearch_quality_score Average quality score\n`
    output += `# TYPE sevensearch_quality_score gauge\n`
    output += `sevensearch_quality_score ${summary.avgQualityScore}\n\n`
    
    // System health metrics
    if (health) {
      output += `# HELP sevensearch_memory_usage Memory usage percentage\n`
      output += `# TYPE sevensearch_memory_usage gauge\n`
      output += `sevensearch_memory_usage ${health.memory}\n\n`
      
      output += `# HELP sevensearch_cpu_usage CPU usage percentage\n`
      output += `# TYPE sevensearch_cpu_usage gauge\n`
      output += `sevensearch_cpu_usage ${health.cpu}\n\n`
    }
    
    return output
  }

  private groupBy<T, K extends string | number | symbol>(
    array: T[],
    keyFn: (item: T) => K
  ): Record<K, T[]> {
    return array.reduce((groups, item) => {
      const key = keyFn(item)
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(item)
      return groups
    }, {} as Record<K, T[]>)
  }

  /**
   * Start automatic health monitoring
   */
  startHealthMonitoring(intervalMs: number = 30000): () => void {
    const interval = setInterval(() => {
      // Collect system health metrics
      const health: Omit<SystemHealth, 'timestamp'> = {
        cpu: this.getCpuUsage(),
        memory: this.getMemoryUsage(),
        responseTime: this.getPerformanceSummary(60000).avgResponseTime,
        errorRate: 1 - this.getPerformanceSummary(60000).successRate,
        throughput: this.getPerformanceSummary(60000).requestCount / 60 // requests per second
      }
      
      this.recordSystemHealth(health)
    }, intervalMs)

    return () => clearInterval(interval)
  }

  private getCpuUsage(): number {
    // In a real implementation, this would get actual CPU usage
    // For now, return a mock value based on recent request load
    const recentRequests = this.getPerformanceSummary(60000).requestCount
    return Math.min(recentRequests * 2, 100)
  }

  private getMemoryUsage(): number {
    // In a real implementation, this would get actual memory usage
    // For now, estimate based on stored metrics
    const baseUsage = 20 // Base application memory
    const metricsUsage = (this.metrics.length / 10000) * 30 // Estimated memory for metrics
    return Math.min(baseUsage + metricsUsage, 100)
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor()

// Helper function to measure execution time
export function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  options?: {
    engineUsed?: string
    userId?: string
    expectedQuality?: number
  }
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now()
    
    try {
      const result = await fn()
      const duration = Date.now() - startTime
      
      performanceMonitor.recordMetric({
        operation,
        duration,
        success: true,
        qualityScore: options?.expectedQuality,
        engineUsed: options?.engineUsed,
        userId: options?.userId
      })
      
      resolve(result)
    } catch (error) {
      const duration = Date.now() - startTime
      
      performanceMonitor.recordMetric({
        operation,
        duration,
        success: false,
        errorType: error instanceof Error ? error.message : 'Unknown error',
        engineUsed: options?.engineUsed,
        userId: options?.userId
      })
      
      reject(error)
    }
  })
}