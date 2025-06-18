"use client"

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { ArrowUp, Search, Sparkles, ChevronDown, Paperclip } from 'lucide-react'
import { TextEffect } from '@/components/motion/text-effect'

interface CleanSearchInterfaceProps {
  onSearch?: (query: string, category?: string) => void
  className?: string
}

export function CleanSearchInterface({ onSearch, className }: CleanSearchInterfaceProps) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('web')

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return

    setIsLoading(true)
    try {
      await onSearch?.(input.trim(), selectedCategory)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const quickPrompts = [
    'AI trends 2024',
    'machine learning algorithms', 
    'web development best practices',
    'data visualization examples'
  ]

  return (
    <div className={cn("min-h-screen flex items-center justify-center px-4", className)}>
      <div className="w-full max-w-4xl mx-auto space-y-8">
        
        {/* Main Title */}
        <div className="text-center space-y-4">
          <TextEffect 
            as="h1"
            preset="fade-in-blur"
            className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent"
          >
            Search Everything
          </TextEffect>
          
          <TextEffect
            preset="fade-in-blur" 
            delay={200}
            className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto"
          >
            Powered by multiple search engines and AI
          </TextEffect>
        </div>

        {/* Search Interface */}
        <div className="w-full max-w-3xl mx-auto">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-sm overflow-hidden">
            
            {/* Category Pills */}
            <div className="flex items-center gap-2 p-3 border-b border-gray-100 dark:border-gray-800">
              {[
                { id: 'web', label: 'Web', icon: Search },
                { id: 'academic', label: 'Academic', icon: Sparkles },
                { id: 'code', label: 'Code', icon: ChevronDown }
              ].map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                    selectedCategory === category.id
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                >
                  <category.icon className="w-4 h-4" />
                  {category.label}
                </button>
              ))}
            </div>

            {/* Main Input */}
            <div className="p-4">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What would you like to search for?"
                disabled={isLoading}
                className="w-full resize-none border-0 bg-transparent text-base leading-relaxed text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 outline-none min-h-[60px] max-h-[200px]"
                rows={1}
                style={{
                  height: 'auto',
                  minHeight: '60px'
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  target.style.height = `${Math.min(target.scrollHeight, 200)}px`
                }}
              />
              
              {/* Bottom Actions */}
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <button
                    className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    aria-label="Attach files"
                    disabled={isLoading}
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  
                  <button
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-50 dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    disabled={isLoading}
                  >
                    <Sparkles className="w-4 h-4" />
                    AI Mode
                  </button>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                    input.trim() && !isLoading
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                  )}
                  aria-label="Search"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ArrowUp className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Prompts */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">Try:</span>
            {quickPrompts.map((prompt, index) => (
              <button
                key={index}
                onClick={() => setInput(prompt)}
                disabled={isLoading}
                className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Subtle Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-400 dark:text-gray-600">
            Powered by Exa, Jina AI, Firecrawl and more
          </p>
        </div>
      </div>
    </div>
  )
}