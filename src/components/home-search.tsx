"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Search, ArrowUp, Sparkles, ChevronDown } from "lucide-react"
import { generateRandomString, cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export function HomeSearch() {
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isAdvanced, setIsAdvanced] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsLoading(true)

    try {
      // Generate a random string for the URL
      const searchId = generateRandomString(10)

      // Create search record in the database
      const createRes = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, searchId, category: 'Web' }),
      }).catch(err => {
        console.error("Failed to create search:", err);
        // Fall back to localStorage if the API call fails
        localStorage.setItem(searchId, query);
        return { ok: true };
      });
      
      if (!createRes || !createRes.ok) {
        // Store the query in localStorage as fallback
        localStorage.setItem(searchId, query);
      }
      
      // Add example search for quick testing (can be removed in production)
      localStorage.setItem("dJ6AwcMNNj", "what is quantum computer explain site:.edu");

      router.push(`/search/${searchId}`);
    } catch (error) {
      console.error("Error creating search:", error);
      setIsLoading(false);
    }
  }
  
  // Automatically adjust textarea height
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "24px"
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [])

  // Update textarea height when query changes
  useEffect(() => {
    adjustTextareaHeight()
  }, [adjustTextareaHeight, query])

  // Focus textarea on initial load
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
      <div className="w-full max-w-[760px] mx-auto">
        <div className={cn(
          "w-full bg-neutral-80 border border-neutral-60/30 rounded-3xl shadow-sm transition-all duration-200 overflow-hidden",
          isFocused && "shadow-focus border-brand-blue/30",
          isLoading && "opacity-70"
        )}>
          <textarea
            ref={textareaRef}
            placeholder="What do you want to know?"
            className="w-full resize-none border-0 bg-transparent p-4 text-base leading-normal text-foreground/85 outline-none min-h-[24px] max-h-[200px] placeholder:text-foreground/50"
            data-testid="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isLoading}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />

          <div className="flex items-center justify-between px-4 py-2 border-t border-neutral-60/10 h-12">
            <div className="flex items-center gap-2">
              {isAdvanced && (
                <button
                  className="h-8 flex items-center justify-center gap-1 rounded-full bg-neutral-60/10 px-3 text-sm font-medium text-foreground/70 hover:bg-neutral-60/20 transition-colors disabled:opacity-50"
                  disabled={isLoading}
                >
                  <Search className="h-4 w-4" />
                  Advanced Search
                  <ChevronDown className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSubmit}
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-full transition-colors",
                  query.trim()
                    ? "text-foreground hover:bg-neutral-60/10"
                    : "opacity-40 cursor-not-allowed"
                )}
                aria-label="Search"
                data-testid="search-button"
                disabled={!query.trim() || isLoading}
              >
                <ArrowUp className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center mt-4 gap-2">
        <Switch
          id="advanced-mode"
          checked={isAdvanced}
          onCheckedChange={setIsAdvanced}
          className="data-[state=checked]:bg-brand-blue"
        />
        <Label htmlFor="advanced-mode" className="text-sm text-foreground/70 flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-brand-blue" />
          Advanced Mode
        </Label>
      </div>
    </div>
  )
}
