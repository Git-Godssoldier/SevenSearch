"use client"

import { cn } from "@/lib/utils"
import React from "react"

type ChatContainerProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>

export function ChatContainer({ children, className, ...props }: ChatContainerProps) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-y-auto",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}