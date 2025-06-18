"use client"

import React, { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Clock, Shield, Star } from 'lucide-react'

interface SearchResult {
  id: string
  title: string
  content: string
  url: string
  source: string
  relevanceScore: number
  credibilityScore: number
  freshnessScore: number
  timestamp: string
}

interface SearchResultsDisplayProps {
  results: SearchResult[]
  metrics?: {
    totalTime: number
    qualityScore: number
    enginePerformance: Record<string, number>
  }
  validation?: {
    passed: boolean
    score: number
    issues: string[]
    recommendations: string[]
  }
  className?: string
}

export function SearchResultsDisplay({
  results,
  metrics,
  validation,
  className
}: SearchResultsDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Preserve scroll position when results update
  useEffect(() => {
    if (resultsRef.current && results.length > 0) {
      const element = resultsRef.current.querySelector('[data-first-result]');
      if (element) {
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest',
          inline: 'nearest' 
        });
      }
    }
  }, [results]);

  if (!results || results.length === 0) {
    return (
      <motion.div 
        className={cn("p-8 text-center", className)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-gray-500 dark:text-gray-400">
          No search results found. Try a different query.
        </div>
      </motion.div>
    )
  }

  const formatScore = (score: number) => Math.round(score * 100)

  return (
    <div ref={containerRef} className={cn("space-y-6", className)}>
      {/* Metrics Header */}
      <AnimatePresence>
        {metrics && (
          <motion.div 
            className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-gray-600 dark:text-gray-400">
                  Found {results.length} results in {metrics.totalTime}ms
                </span>
                <Badge variant="secondary" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                  Quality: {formatScore(metrics.qualityScore)}%
                </Badge>
              </div>
              
              {validation?.recommendations && validation.recommendations.length > 0 && (
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  💡 {validation.recommendations[0]}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Results */}
      <div ref={resultsRef} className="space-y-4">
        <AnimatePresence mode="popLayout">
          {results.map((result, index) => (
            <motion.div
              key={`result-${result.id}-${result.url}`} // Stable key combining id and url
              data-first-result={index === 0 ? "true" : undefined}
              layout="position"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ 
                duration: 0.3,
                delay: index * 0.05, // Stagger animation
                layout: { type: "spring", stiffness: 300, damping: 30 }
              }}
            >
              <Card className="hover:shadow-lg transition-all duration-200 hover:scale-[1.01]">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle className="text-lg leading-tight">
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline flex items-center gap-2 transition-colors duration-200"
                      >
                        {result.title}
                        <ExternalLink className="h-4 w-4 flex-shrink-0" />
                      </a>
                    </CardTitle>
                    
                    <motion.div 
                      className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      <span>#{index + 1}</span>
                    </motion.div>
                  </div>
                  
                  {/* Source and URL */}
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Badge variant="outline" className="text-xs">
                      {result.source}
                    </Badge>
                    <span className="text-xs text-gray-500 dark:text-gray-500 truncate max-w-md">
                      {result.url}
                    </span>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  {/* Content */}
                  <motion.p 
                    className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    {result.content}
                  </motion.p>
                  
                  {/* Quality Scores */}
                  <motion.div 
                    className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      <span>Relevance: {formatScore(result.relevanceScore)}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      <span>Credibility: {formatScore(result.credibilityScore)}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>Freshness: {formatScore(result.freshnessScore)}%</span>
                    </div>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Engine Performance */}
      <AnimatePresence>
        {metrics?.enginePerformance && Object.keys(metrics.enginePerformance).length > 0 && (
          <motion.div 
            className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search Engine Performance
            </h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(metrics.enginePerformance).map(([engine, time], index) => (
                <motion.div
                  key={engine}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Badge variant="secondary" className="text-xs">
                    {engine}: {time}ms
                  </Badge>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Validation Issues */}
      <AnimatePresence>
        {validation?.issues && validation.issues.length > 0 && (
          <motion.div 
            className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
              Search Quality Notes
            </h3>
            <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
              {validation.issues.map((issue, index) => (
                <motion.li 
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  • {issue}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}