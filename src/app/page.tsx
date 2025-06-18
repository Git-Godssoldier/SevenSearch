"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CleanSearchInterface } from '@/components/clean-search-interface'
import { GrokInspiredInput } from '@/components/grok-inspired-input'
import { TextEffect } from '@/components/motion/text-effect'

export default function HomePage() {
  const router = useRouter()
  const [searchMode, setSearchMode] = useState<'clean' | 'grok'>('clean')

  const handleSearch = async (query: string, category?: string) => {
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, category }),
      })

      if (response.ok) {
        const data = await response.json()
        
        // Store search results in sessionStorage for the results page
        sessionStorage.setItem('searchResults', JSON.stringify({
          query,
          category,
          results: data.results,
          metrics: data.metrics,
          validation: data.validation,
          searchId: data.searchId
        }))

        // Navigate to results page
        router.push(`/search/${data.searchId}`)
      }
    } catch (error) {
      console.error('Search failed:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      {/* Toggle between interfaces */}
      <div className="absolute top-4 right-4 z-10">
        <div className="flex items-center gap-2 p-1 bg-white dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm">
          <button
            onClick={() => setSearchMode('clean')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              searchMode === 'clean'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Clean
          </button>
          <button
            onClick={() => setSearchMode('grok')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              searchMode === 'grok'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Grok
          </button>
        </div>
      </div>

      {/* Clean Interface */}
      {searchMode === 'clean' && (
        <CleanSearchInterface onSearch={handleSearch} />
      )}

      {/* Grok-Inspired Interface */}
      {searchMode === 'grok' && (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="w-full max-w-4xl mx-auto space-y-8">
            
            {/* Grok-style minimal title */}
            <div className="text-center space-y-4">
              <TextEffect 
                as="h1"
                preset="fade-in-blur"
                className="text-4xl md:text-5xl font-semibold text-gray-900 dark:text-white"
              >
                Ask anything
              </TextEffect>
            </div>

            {/* Grok Input */}
            <GrokInspiredInput onSubmit={(query) => handleSearch(query)} autoFocus />
            
          </div>
        </div>
      )}
    </div>
  )
}