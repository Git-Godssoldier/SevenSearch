"use client"

import { TextEffect } from "@/components/motion/text-effect"
import { Button } from "@/components/ui/button"
import { ArrowRight, Search, Sparkles } from "lucide-react"
import { motion } from "framer-motion"

interface HeroSectionProps {
  onGetStarted?: () => void;
  title?: string;
  subtitle?: string;
  ctaText?: string;
}

export function HeroSection({ 
  onGetStarted, 
  title = "Search Everything, Find Anything",
  subtitle = "Powered by multiple search engines and AI to give you the most comprehensive results",
  ctaText = "Start Searching"
}: HeroSectionProps) {
  return (
    <section className="relative min-h-[60vh] flex items-center justify-center px-4 py-16">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800" />
      
      {/* Content */}
      <div className="relative z-10 text-center space-y-8 max-w-4xl mx-auto">
        {/* Main title with text effects */}
        <div className="space-y-4">
          <TextEffect
            per="word"
            preset="fade-in-blur"
            className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent"
            delay={0.2}
          >
            {title}
          </TextEffect>
          
          <TextEffect
            per="word"
            preset="slide"
            className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed"
            delay={0.5}
          >
            {subtitle}
          </TextEffect>
        </div>

        {/* Feature highlights */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-500" />
            <span>Multi-engine search</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span>AI-powered results</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-pink-500" />
            <span>Real-time aggregation</span>
          </div>
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1, duration: 0.4 }}
        >
          <Button
            size="lg"
            onClick={onGetStarted}
            className="group relative px-8 py-4 text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            <span className="relative z-10 flex items-center gap-2">
              {ctaText}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
            
            {/* Animated background */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-700 rounded-md opacity-0 group-hover:opacity-100"
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          </Button>
        </motion.div>

        {/* Floating elements for visual interest */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-200 rounded-full opacity-20 blur-3xl"
            animate={{
              x: [0, 50, 0],
              y: [0, -30, 0],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute top-3/4 right-1/4 w-48 h-48 bg-purple-200 rounded-full opacity-20 blur-3xl"
            animate={{
              x: [0, -40, 0],
              y: [0, 20, 0],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
          />
        </div>
      </div>
    </section>
  )
}