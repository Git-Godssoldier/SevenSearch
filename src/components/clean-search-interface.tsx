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
    <div className={cn("min-h-screen flex items-center justify-center px-4 bg-bg", className)}>
      <div className="w-full max-w-4xl mx-auto space-y-8">
        
        {/* Main Title */}
        <div className="text-center space-y-4">
          <TextEffect 
            as="h1"
            preset="fade-in-blur"
            className="text-5xl md:text-6xl font-bold text-text"
          >
            Search Everything
          </TextEffect>
          
          <TextEffect
            preset="fade-in-blur" 
            delay={200}
            className="text-lg text-muted max-w-2xl mx-auto"
          >
            Powered by multiple search engines and AI
          </TextEffect>
        </div>

        {/* Search Interface */}
        <div className="w-full max-w-3xl mx-auto">
          <div className="bg-surface border border-border rounded-3xl shadow-sm overflow-hidden">
            
            {/* Category Pills */}
            <div className="flex items-center gap-2 p-3 border-b border-border">
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
                      ? "bg-primary/10 text-primary"
                      : "text-muted hover:bg-surface-2"
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
                className="w-full resize-none border-0 bg-transparent text-base leading-relaxed text-text placeholder:text-muted/60 outline-none min-h-[60px] max-h-[200px]"
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
                    className="p-2 rounded-full text-muted hover:bg-surface-2 transition-colors"
                    aria-label="Attach files"
                    disabled={isLoading}
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  
                  <button
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-2 text-sm font-medium text-muted hover:bg-border transition-colors"
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
                      ? "bg-primary hover:bg-primary/90 text-on-primary"
                      : "bg-surface-2 text-muted/50 cursor-not-allowed"
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
            <span className="text-sm text-muted mr-2">Try:</span>
            {quickPrompts.map((prompt, index) => (
              <button
                key={index}
                onClick={() => setInput(prompt)}
                disabled={isLoading}
                className="px-3 py-1 rounded-full bg-surface-2 text-sm text-muted hover:bg-border transition-colors disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Subtle Footer */}
        <div className="text-center">
          <p className="text-xs text-muted/80">
            Powered by Exa, Jina AI, Firecrawl and more
          </p>
        </div>
      </div>
    </div>
  )
}
