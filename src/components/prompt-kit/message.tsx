"use client"

import { Markdown } from "@/components/prompt-kit/markdown"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import React from "react"

type MessageProps = {
  children: React.ReactNode
  className?: string
}

function Message({ children, className }: MessageProps) {
  return (
    <TooltipProvider>
      <div className={cn("group relative flex flex-col gap-3", className)}>
        {children}
      </div>
    </TooltipProvider>
  )
}

type MessageContentProps = {
  children: React.ReactNode
  className?: string
  markdown?: boolean
}

function MessageContent({ children, className, markdown = false }: MessageContentProps) {
  if (markdown) {
    return (
      <div className={cn("prose dark:prose-invert", className)}>
        <Markdown>{children as string}</Markdown>
      </div>
    )
  }

  return <div className={className}>{children}</div>
}

type MessageActionsProps = React.HTMLAttributes<HTMLDivElement>

function MessageActions({ children, className, ...props }: MessageActionsProps) {
  return (
    <div className={cn("flex items-center gap-1", className)} {...props}>
      {children}
    </div>
  )
}

type MessageActionProps = {
  className?: string
  tooltip: React.ReactNode
  children: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
} & React.ComponentProps<typeof Tooltip>

function MessageAction({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}: MessageActionProps) {
  return (
    <Tooltip {...props}>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

export { Message, MessageContent, MessageActions, MessageAction }