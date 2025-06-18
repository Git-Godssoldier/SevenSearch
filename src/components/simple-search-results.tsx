"use client"

import React, { useEffect, useState, useCallback } from 'react'
import { SearchResultsDisplay } from '@/components/search-results-display'
import { Loader2, Wifi, WifiOff } from 'lucide-react'
import { SSEMessage } from '@/lib/utils/sse'

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

interface SearchResponse {
  results: SearchResult[]
  metrics: {
    totalTime: number
    qualityScore: number
    enginePerformance: Record<string, number>
  }
  validation: {
    passed: boolean
    score: number
    issues: string[]
    recommendations: string[]
  }
  searchId: string
  note?: string
}

interface SimpleSearchResultsProps {
  searchId: string
}

export function SimpleSearchResults({ searchId }: SimpleSearchResultsProps) {
  const [searchData, setSearchData] = useState<SearchResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [streamingProgress, setStreamingProgress] = useState<SSEMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamConnected, setStreamConnected] = useState(false)

  // Handle streaming progress updates
  const handleStreamMessage = useCallback((message: SSEMessage) => {
    console.log('[Search Results] Stream message:', message);
    setStreamingProgress(prev => [...prev, message]);
    
    if (message.type === 'workflow_completed') {
      setIsStreaming(false);
      setIsLoading(false);
      // Trigger a final data fetch to get complete results
      fetchSearchData();
    }
  }, []);

  // Fetch search data from API
  const fetchSearchData = useCallback(async () => {
    try {
      const checkResponse = await fetch(`/api/search?id=${searchId}`)
      if (checkResponse.ok) {
        const dbData = await checkResponse.json()
        if (dbData && dbData.completed) {
          const convertedData: SearchResponse = {
            results: [{
              id: `db_${Date.now()}`,
              title: `Results for "${dbData.query}"`,
              content: dbData.summary || 'Search completed successfully.',
              url: '#',
              source: 'Database',
              relevanceScore: 0.8,
              credibilityScore: 0.9,
              freshnessScore: 0.7,
              timestamp: dbData.created_at || new Date().toISOString()
            }],
            metrics: {
              totalTime: 100,
              qualityScore: 0.8,
              enginePerformance: { database: 100 }
            },
            validation: {
              passed: true,
              score: 0.8,
              issues: [],
              recommendations: ['Results loaded from database.']
            },
            searchId: dbData.searchId || searchId
          }
          setSearchData(convertedData)
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Error fetching search data:', err);
      return false;
    }
  }, [searchId]);

  // Start streaming search
  const startStreamingSearch = useCallback(async () => {
    try {
      setIsStreaming(true);
      setStreamConnected(false);
      
      const query = localStorage.getItem(searchId) || searchId.replace(/^search_\d+_/, '').replace(/_/g, ' ') || 'search query';
      
      const response = await fetch('/api/enhance-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query,
          searchId 
        }),
      });

      if (!response.ok) {
        throw new Error(`Streaming failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body for streaming');
      }

      setStreamConnected(true);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('[Search Results] Stream completed');
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const message: SSEMessage = JSON.parse(line);
              handleStreamMessage(message);
            } catch (parseError) {
              console.warn('[Search Results] Failed to parse chunk:', line);
            }
          }
        }
      } finally {
        reader.releaseLock();
        setStreamConnected(false);
      }
    } catch (err) {
      console.error('Streaming error:', err);
      setError(err instanceof Error ? err.message : 'Streaming failed');
      setIsStreaming(false);
      setStreamConnected(false);
    }
  }, [searchId, handleStreamMessage]);

  useEffect(() => {
    const initialize = async () => {
      try {
        // First check if we have cached results
        const storedResults = sessionStorage.getItem('searchResults')
        if (storedResults) {
          const parsedResults = JSON.parse(storedResults)
          if (parsedResults.searchId === searchId) {
            setSearchData(parsedResults)
            setIsLoading(false)
            return
          }
        }

        // Check if search already exists in database
        const hasData = await fetchSearchData();
        if (hasData) {
          setIsLoading(false);
          return;
        }

        // Start streaming search if no existing data
        await startStreamingSearch();
        
      } catch (err) {
        console.error('Initialization error:', err)
        setError(err instanceof Error ? err.message : 'Search initialization failed')
        setIsLoading(false)
      }
    }

    if (searchId) {
      initialize()
    }
  }, [searchId, fetchSearchData, startStreamingSearch])

  if (isLoading || isStreaming) {
    return (
      <div className="space-y-6">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border">
          <div className="flex items-center space-x-2">
            {streamConnected ? (
              <Wifi className="h-4 w-4 text-green-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-gray-400" />
            )}
            <span className="text-sm font-medium">
              {streamConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Real-time search in progress
            </span>
          </div>
        </div>

        {/* Progress Steps */}
        {streamingProgress.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Search Progress</h3>
            <div className="space-y-2">
              {streamingProgress.map((progress, index) => (
                <div 
                  key={index} 
                  className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {progress.step}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium capitalize">
                      {progress.type.replace(/_/g, ' ')}
                    </p>
                    {progress.payload?.message && (
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {progress.payload.message}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    Step {progress.step}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fallback loading state */}
        {streamingProgress.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
              <p className="text-gray-600 dark:text-gray-400">
                Initializing search...
              </p>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-red-800 dark:text-red-200 font-medium mb-2">Search Error</h3>
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (!searchData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">No search results found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search Info */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Search Results
        </h1>
        {searchData.note && (
          <p className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
            ℹ️ {searchData.note}
          </p>
        )}
      </div>

      {/* Results Display */}
      <SearchResultsDisplay
        results={searchData.results}
        metrics={searchData.metrics}
        validation={searchData.validation}
      />
    </div>
  )
}
