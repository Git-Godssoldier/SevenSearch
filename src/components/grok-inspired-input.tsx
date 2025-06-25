"use client"

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { 
  ArrowUp, 
  ChevronDown, 
  Search, 
  Sparkles, 
  Paperclip,
  ImageIcon,
  HelpCircle 
} from 'lucide-react'

interface GrokInspiredInputProps {
  onSubmit?: (message: string) => void
  className?: string
  disabled?: boolean
  autoFocus?: boolean
}

export function GrokInspiredInput({
  onSubmit,
  className,
  disabled = false,
  autoFocus = false
}: GrokInspiredInputProps) {
  const [input, setInput] = useState('')
  const [showModelTooltip, setShowModelTooltip] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  const handleSubmit = () => {
    if (!input.trim() || disabled) return
    onSubmit?.(input.trim())
    setInput('')
    
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = '24px'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }

  useEffect(() => {
    adjustTextareaHeight()
  }, [input])

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
      <div
        className={cn(
          "w-full max-w-[760px] bg-surface border border-border rounded-3xl shadow-sm overflow-hidden",
          disabled && "opacity-70",
          className
        )}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What would you like to search for?"
          disabled={disabled}
          className="w-full resize-none border-0 bg-transparent p-4 text-base leading-normal text-text outline-none min-h-[24px] placeholder:text-muted/60"
        />

        <div className="flex items-center justify-between px-4 py-2 border-t border-border h-12">
          <div className="flex items-center gap-2">
            <button
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-2 text-muted transition-colors disabled:opacity-50"
              aria-label="Attach files"
              disabled={disabled}
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <button
              className="h-8 flex items-center justify-center gap-1 rounded-full bg-surface-2 px-3 text-sm font-medium text-muted hover:bg-border transition-colors disabled:opacity-50"
              disabled={disabled}
            >
              <Search className="h-4 w-4" />
              Multi-Engine
              <ChevronDown className="h-4 w-4" />
            </button>

            <button
              className="h-8 flex items-center justify-center gap-1 rounded-full bg-surface-2 px-3 text-sm font-medium text-muted hover:bg-border transition-colors disabled:opacity-50"
              disabled={disabled}
            >
              <Sparkles className="h-4 w-4" />
              AI Enhance
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                className="h-8 flex items-center justify-center gap-1 rounded-full px-3 text-sm font-medium text-muted hover:bg-surface-2 transition-colors disabled:opacity-50"
                onMouseEnter={() => setShowModelTooltip(true)}
                onMouseLeave={() => setShowModelTooltip(false)}
                disabled={disabled}
              >
                HALO Search
                <ChevronDown className="h-4 w-4" />
              </button>

              {showModelTooltip && (
                <div className="absolute top-full right-0 mt-1 bg-surface-2 text-text rounded-lg p-3 w-[250px] z-10 border border-border">
                  <div className="font-semibold text-sm mb-1">HALO Orchestrator</div>
                  <div className="font-normal text-sm opacity-80">Multi-engine search with AI coordination</div>
                </div>
              )}
            </div>

            <button
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-full transition-colors",
                input.trim() 
                  ? "bg-primary hover:bg-primary/90 text-on-primary" 
                  : "bg-surface-2 text-muted/50 cursor-not-allowed"
              )}
              aria-label="Send message"
              disabled={!input.trim() || disabled}
              onClick={handleSubmit}
            >
              <ArrowUp className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4 justify-center">
        <button
          className="h-9 flex items-center justify-center gap-2 rounded-full bg-surface-2 px-4 text-sm font-medium text-muted hover:bg-border transition-colors disabled:opacity-50"
          disabled={disabled}
        >
          <Search className="h-4 w-4" />
          Research
        </button>

        <button
          className="h-9 flex items-center justify-center gap-2 rounded-full bg-surface-2 px-4 text-sm font-medium text-muted hover:bg-border transition-colors disabled:opacity-50"
          disabled={disabled}
        >
          <HelpCircle className="h-4 w-4" />
          How to
        </button>

        <button
          className="h-9 flex items-center justify-center gap-2 rounded-full bg-surface-2 px-4 text-sm font-medium text-muted hover:bg-border transition-colors disabled:opacity-50"
          disabled={disabled}
        >
          <ImageIcon className="h-4 w-4" />
          Visual search
        </button>
      </div>

      <div className="text-xs text-muted/80 text-center mt-4">
        Powered by HALO orchestration with Exa, Jina AI, and Firecrawl
      </div>
    </div>
  )
}
