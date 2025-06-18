"use client"

import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/prompt-kit/prompt-input"
import { Button } from "@/components/ui/button"
import { TextEffect } from "@/components/motion/text-effect"
import { AnimatedBackground } from "@/components/motion/animated-background"
import { ArrowUp, Globe, Plus, Search, Sparkles, FileText, Code, Database, Brain } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { generateRandomString, cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

const searchCategories = [
  { id: "web", label: "Web Search", icon: Globe, color: "bg-blue-500" },
  { id: "code", label: "Code Search", icon: Code, color: "bg-green-500" },
  { id: "academic", label: "Academic", icon: FileText, color: "bg-purple-500" },
  { id: "data", label: "Data Analysis", icon: Database, color: "bg-orange-500" },
  { id: "ai", label: "AI Research", icon: Brain, color: "bg-pink-500" },
]

const searchSuggestions = [
  "What is quantum computing and how does it work?",
  "Latest developments in artificial intelligence 2024",
  "How to optimize React performance for large applications",
  "Climate change impact on global economics",
  "Best practices for database design and optimization"
]

export function EnhancedChatSearch() {
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [focusedSuggestion, setFocusedSuggestion] = useState(-1)
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async () => {
    if (!input.trim()) return
    
    setIsLoading(true)
    try {
      const searchId = generateRandomString(10)
      
      const createRes = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: input, 
          searchId,
          category: activeCategory 
        }),
      }).catch(err => {
        console.error("Failed to create search:", err)
        localStorage.setItem(searchId, input)
        return { ok: true }
      })
      
      if (!createRes || !createRes.ok) {
        localStorage.setItem(searchId, input)
      }
      
      router.push(`/search/${searchId}`)
    } catch (error) {
      console.error("Error creating search:", error)
      setIsLoading(false)
    }
  }

  const handleValueChange = (value: string) => {
    setInput(value)
    setShowSuggestions(value.length > 0)
    setFocusedSuggestion(-1)
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
    setShowSuggestions(false)
    handleSubmit()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!showSuggestions) return
    
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedSuggestion(prev => 
        prev < searchSuggestions.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedSuggestion(prev => prev > 0 ? prev - 1 : -1)
    } else if (e.key === 'Enter' && focusedSuggestion >= 0) {
      e.preventDefault()
      handleSuggestionClick(searchSuggestions[focusedSuggestion])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setFocusedSuggestion(-1)
    }
  }

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showSuggestions, focusedSuggestion])

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Title with animated text effect */}
      <div className="text-center space-y-4">
        <TextEffect
          per="word"
          as="h1"
          preset="fade-in-blur"
          className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
        >
          Search Across Everything
        </TextEffect>
        <TextEffect
          per="word"
          preset="slide"
          delay={0.3}
          className="text-lg text-muted-foreground"
        >
          Powered by multiple search engines and AI
        </TextEffect>
      </div>

      {/* Search Categories */}
      <AnimatedBackground
        className="rounded-lg bg-primary/10"
        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        onValueChange={setActiveCategory}
      >
        <div className="flex flex-wrap justify-center gap-2 p-2">
          {searchCategories.map((category) => (
            <button
              key={category.id}
              data-id={category.id}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                "hover:bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/50",
                activeCategory === category.id && "text-primary-foreground"
              )}
            >
              <category.icon className="w-4 h-4" />
              {category.label}
            </button>
          ))}
        </div>
      </AnimatedBackground>

      {/* Main Search Input */}
      <div className="relative">
        <PromptInput
          value={input}
          onValueChange={handleValueChange}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          className="border-input bg-background w-full border px-3 py-2 shadow-lg hover:shadow-xl transition-shadow duration-200"
        >
          <PromptInputTextarea
            ref={textareaRef}
            placeholder="Ask anything... (Press Tab for suggestions)"
            className="text-base placeholder:text-base md:text-lg md:placeholder:text-lg min-h-[60px]"
            onFocus={() => setShowSuggestions(input.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          />
          
          <PromptInputActions className="mt-4 mb-2 flex h-auto items-center justify-between gap-2">
            <div className="flex items-center gap-x-2">
              <PromptInputAction
                delayDuration={0}
                tooltip={
                  <div className="bg-black text-white px-2 py-1 rounded text-xs">
                    Attach files
                  </div>
                }
              >
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Attach files"
                  className="h-9 w-9 rounded-full border border-input hover:bg-secondary"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </PromptInputAction>
              
              <PromptInputAction
                delayDuration={0}
                tooltip={
                  <div className="bg-black text-white px-2 py-1 rounded text-xs">
                    Advanced search
                  </div>
                }
              >
                <Button
                  variant="ghost"
                  className="h-9 rounded-full border border-input hover:bg-secondary px-3"
                >
                  <Search className="h-4 w-4 mr-1" />
                  Advanced
                </Button>
              </PromptInputAction>
              
              <PromptInputAction
                delayDuration={0}
                tooltip={
                  <div className="bg-black text-white px-2 py-1 rounded text-xs">
                    AI-powered search
                  </div>
                }
              >
                <Button
                  variant="ghost"
                  className="h-9 rounded-full border border-input hover:bg-secondary px-3"
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  AI Mode
                </Button>
              </PromptInputAction>
            </div>
            
            <PromptInputAction
              delayDuration={0}
              tooltip={
                <div className="bg-black text-white px-2 py-1 rounded text-xs">
                  {isLoading ? "Stop search" : "Start search"}
                </div>
              }
            >
              <Button
                variant="default"
                size="icon"
                aria-label={isLoading ? "Stop search" : "Start search"}
                className="h-10 w-10 rounded-full"
                onClick={handleSubmit}
                disabled={!input.trim()}
              >
                <motion.div
                  animate={isLoading ? { rotate: 360 } : { rotate: 0 }}
                  transition={isLoading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
                >
                  {isLoading ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ArrowUp className="h-5 w-5" />
                  )}
                </motion.div>
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>

        {/* Search Suggestions Dropdown */}
        <AnimatePresence>
          {showSuggestions && searchSuggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full left-0 right-0 mt-2 bg-background border border-input rounded-xl shadow-xl z-50 overflow-hidden"
            >
              <div className="p-2">
                <div className="text-xs font-medium text-muted-foreground px-3 py-2">
                  Suggested searches
                </div>
                {searchSuggestions.map((suggestion, index) => (
                  <motion.button
                    key={suggestion}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-secondary transition-colors",
                      focusedSuggestion === index && "bg-secondary"
                    )}
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <Search className="inline-block w-3 h-3 mr-2 text-muted-foreground" />
                    {suggestion}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex flex-wrap justify-center gap-2 text-sm text-muted-foreground"
      >
        <span>Try searching for:</span>
        {["AI trends", "code examples", "research papers", "data visualization"].map((term, index) => (
          <motion.button
            key={term}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 + index * 0.1 }}
            className="px-2 py-1 rounded bg-secondary hover:bg-secondary/80 transition-colors"
            onClick={() => {
              setInput(term)
              handleSubmit()
            }}
          >
            {term}
          </motion.button>
        ))}
      </motion.div>
    </div>
  )
}