# Styling a Chat Input Following the Opulentia Design System

This guide explains how to style a chat input component to follow the Opulentia Design System using existing Scrpexity components without requiring full prompt-kit integration.

## Overview

The goal is to create a chat input that:
1. Has a clean, minimal aesthetic aligned with the Opulentia neutral scale
2. Uses a rounded pill/rectangle shape with appropriate neutral-scale borders
3. Has a textarea that expands as content grows
4. Shows a subtle border/shadow to differentiate from background using the neutral color scale
5. Includes a send button using World Blue brand colors that changes based on input state
6. Maintains all existing functionality while integrating with the OpulentiaAI/SevenSearch repository's styling

## Compatibility with Mastra vNext Implementation

This styling approach is fully compatible with the planned Mastra vNext implementation:

1. The UI changes are purely cosmetic and don't affect the data flow or API structure
2. All streaming functionality remains intact as the client-side UI is decoupled from the backend implementation
3. The same event structure (`step: 1`, `step: 2`, etc.) can be maintained in the Mastra workflow outputs

## Implementation Approach

We'll modify our existing component styling while preserving the core functionality. The key elements to adjust are:

- Container shape and styling
- Input field appearance and behavior
- Send button styling and states
- Animation and interaction effects

## Step 1: Modify the Chat Input Container

Update the chat input container styling to match ChatGPT's rounded rectangle look with a subtle border:

```tsx
// In home-search.tsx for the main search input
<form onSubmit={handleSubmit} className="relative bg-card rounded-lg shadow-lg p-1">
  <div className="relative flex items-center">
    <Search className="absolute left-4 h-5 w-5 text-muted-foreground" />
    <Input
      placeholder="What do you want to know?"
      className="pl-12 pr-20 py-7 text-base md:text-lg bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      disabled={isLoading}
    />
    <Button
      type="submit"
      // Use Opulentia's World Blue brand color following the definitive color system
      className="absolute right-2 bg-brand-blue hover:bg-brand-blue/90 text-foreground rounded-md py-2 px-4 flex items-center gap-2 transition-colors duration-200"
      disabled={isLoading || !query.trim()}
    >
      {isLoading ? "Searching..." : "Search"}
      <ArrowUp className="h-4 w-4" />
    </Button>
  </div>
</form>
```

## Step 2: Update the Textarea Styling

Modify the textarea to expand naturally and have similar styling to ChatGPT's input:

```tsx
// Modify the styling in MorphingInput component or use directly in chat-input.tsx
<PromptInputTextarea
  value={value}
  onChange={(e) => onValueChange(e.target.value)}
  placeholder={placeholder}
  // ChatGPT-like styling
  className="p-3 py-4 text-foreground/85 text-base leading-normal placeholder:text-foreground/50 bg-transparent border-none focus-visible:ring-0 min-h-[24px] max-h-[200px] w-full"
  disableAutosize={disableAutosize}
  disabled={disabled}
  autoFocus={autoFocus}
/>
```

## Step 3: Simplify the Action Bar

Update the action bar to match ChatGPT's minimal approach with just a send button that changes state based on input:

```tsx
<div className="flex h-[44px] items-center justify-between px-3 py-2 bg-transparent">
  {/* Optional: Left side actions like attachments */}
  <div className="flex items-center gap-2">
    {allowAttachments && (
      <PromptInputAction tooltip="Attach files">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md bg-transparent text-foreground/70 hover:bg-neutral-60/10"
          onClick={handleAttachClick}
          disabled={isLoading}
        >
          <Paperclip className="size-[18px]" />
          <span className="sr-only">Attach files</span>
        </Button>
      </PromptInputAction>
    )}
    <input
      type="file"
      id="chat-file-input"
      className="hidden"
      onChange={handleFileChange}
      multiple
      disabled={isLoading}
      aria-label="Attach files"
    />
  </div>

  {/* Right side with send button */}
  <div className="flex items-center">
    <PromptInputAction tooltip={isLoading ? "Stop generation" : "Send message"}>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8 rounded-md transition-colors duration-200",
          value.trim()
            // Use Opulentia's World Blue following the definitive color system
            ? "bg-brand-blue text-foreground hover:bg-brand-blue/90"
            : "bg-transparent text-foreground/40 hover:bg-neutral-60/10",
          isLoading && "bg-destructive hover:bg-destructive/90"
        )}
        onClick={handleSubmit}
        disabled={isLoading && !value.trim()}
      >
        {isLoading ? (
          <Square className="size-[16px]" />
        ) : (
          <ArrowUp className="size-[16px]" />
        )}
        <span className="sr-only">{isLoading ? "Stop generation" : "Send message"}</span>
      </Button>
    </PromptInputAction>
  </div>
</div>
```

## Step 4: Add Focus State Styling

Enhance the focus state to match ChatGPT's subtle highlighting when the input is focused:

```tsx
// No need to add custom CSS class styles since we've added the shadow system
// to globals.css following the Opulentia Design System
// The shadow-focus utility class is already defined with proper styling

// Simply use the shadow-focus class conditionally with React useState
const [isFocused, setIsFocused] = useState(false);

// In your JSX:
<PromptInput
  className={cn(
    "bg-neutral-80 border border-neutral-40 rounded-lg shadow-card p-0 overflow-hidden mb-4 transition-all duration-200",
    isFocused && "shadow-focus"
  )}
  // ...other props
>
  <PromptInputTextarea
    // ...other props
    onFocus={() => setIsFocused(true)}
    onBlur={() => setIsFocused(false)}
  />
</PromptInput>
```

## Step 5: Behavior Adjustments

Make the following behavior adjustments to match ChatGPT's input experience:

1. Auto-resize input height based on content (already implemented)
2. Change send button color when text is present (implemented above)
3. Disable send button when input is empty (implemented above)
4. Add subtle transition animations for smoother interaction

```tsx
// Add these transition properties to the relevant elements
// For the container:
"transition-all duration-200"

// For the send button:
"transition-colors duration-200"

// For expanding textarea:
"transition-height duration-150"
```

## Complete Implementation Example

Here's a simplified example of how the complete `ChatInput` component might look:

```tsx
"use client";

import { useState } from "react";
import { Paperclip, ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputAction,
} from "@/components/ui/prompt-input";
import { cn } from "@/lib/utils";

export interface ChatInputProps {
  placeholder?: string;
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  allowAttachments?: boolean;
  onAttach?: (files: FileList) => void;
  disableAutoFocus?: boolean;
  className?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  placeholder = "Ask Opulentia AI…", // Updated to match OpulentiaAI branding
  onSendMessage,
  isLoading = false,
  allowAttachments = true,
  onAttach,
  disableAutoFocus = false,
  className,
}) => {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = () => {
    if (value.trim() && !isLoading) {
      onSendMessage(value);
      setValue("");
    }
  };

  const handleAttachClick = () => {
    const fileInput = document.getElementById("chat-file-input");
    if (fileInput) {
      fileInput.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && onAttach) {
      onAttach(event.target.files);
    }
  };

  return (
    <div className={cn("relative max-w-3xl mx-auto", className)}>
      <PromptInput
        value={value}
        onValueChange={setValue}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        disabled={isLoading}
        className={cn(
          "bg-neutral-80 border border-neutral-60/30 rounded-lg shadow-sm p-0 overflow-hidden mb-4 transition-all duration-200",
          isFocused && "shadow-focus"
        )}
      >
        <PromptInputTextarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="p-3 py-4 text-foreground/85 text-base leading-normal placeholder:text-foreground/50 bg-transparent border-none focus-visible:ring-0 min-h-[24px] max-h-[200px] w-full transition-all duration-150"
          disabled={isLoading}
          autoFocus={!disableAutoFocus}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />

        <div className="flex h-[44px] items-center justify-between px-3 py-2 bg-transparent">
          <div className="flex items-center gap-2">
            {allowAttachments && (
              <PromptInputAction tooltip="Attach files">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-md bg-transparent text-foreground/70 hover:bg-neutral-60/10 transition-colors duration-200"
                  onClick={handleAttachClick}
                  disabled={isLoading}
                >
                  <Paperclip className="size-[18px]" />
                  <span className="sr-only">Attach files</span>
                </Button>
              </PromptInputAction>
            )}
            <input
              type="file"
              id="chat-file-input"
              className="hidden"
              onChange={handleFileChange}
              multiple
              disabled={isLoading}
              aria-label="Attach files"
            />
          </div>

          <div className="flex items-center">
            <PromptInputAction tooltip={isLoading ? "Stop generation" : "Send message"}>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-md transition-colors duration-200",
                  value.trim()
                    ? "bg-brand-pink text-white hover:bg-brand-pink/90"
                    : "bg-transparent text-foreground/40 hover:bg-neutral-60/10",
                  isLoading && "bg-destructive hover:bg-destructive/90"
                )}
                onClick={handleSubmit}
                // Fix the disabled logic to prevent submitting empty messages
                disabled={isLoading || !value.trim()}
              >
                {isLoading ? (
                  <Square className="size-[16px]" />
                ) : (
                  <ArrowUp className="size-[16px]" />
                )}
                <span className="sr-only">{isLoading ? "Stop generation" : "Send message"}</span>
              </Button>
            </PromptInputAction>
          </div>
        </div>
      </PromptInput>
    </div>
  );
};
```

## Key Differences to Note

Here are the key differences between our original chat input and the ChatGPT-styled version:

1. **Shape**: ChatGPT uses a more subtle rounded rectangle vs. our rounded-3xl pill shape
2. **Input Padding**: ChatGPT uses more padding inside the input area (especially top/bottom)
3. **Send Button**: ChatGPT's send button has a color state for active/inactive rather than always showing
4. **Focus State**: ChatGPT has a subtle border highlight when the input is focused
5. **Size**: ChatGPT's input area starts smaller and expands as content is added
6. **Simplicity**: ChatGPT has fewer buttons/actions visible by default

## Maintaining Functionality

This styling approach preserves all existing functionality:
- Text input and submission
- File attachments (if enabled)
- Loading states
- Auto-expanding textarea
- Keyboard shortcuts (Enter to send)

The changes are purely cosmetic and don't affect the underlying behavior of the component.

## Integration with Mastra vNext and Streaming API

This UI styling approach is fully compatible with the planned Mastra vNext implementation for OpulentiaAI/SevenSearch:

1. **Streaming Compatibility**: The UI changes don't modify how streaming data is consumed by the client. The search-results.tsx component will continue to handle streaming updates as before, supporting the StreamingTextResponse from the Vercel AI SDK.

2. **Step-Based Progress Indicators**: The UI maintains the same step-based updates (enhancing, searching, reading, wrapping) that correspond directly to the Mastra workflow steps described in the implementation plan.

3. **Error Handling**: The error states in the UI can be directly mapped to the retry and error handling mechanisms in Mastra, providing users with clear feedback when issues occur.

4. **Opulentia Color System Integration**: The styling follows the Opulentia neutral scale and uses World Blue as the primary brand color, consistent with the definitive color guide.

5. **Stream Data Format**: The styling changes don't affect the expected stream data format:
   ```typescript
   { step: 1, enhancedQuery } // for query enhancement
   { step: 2, streamUrl } // for search initiation
   { step: 3, link, contentBlocks } // for each source
   { step: 4, summary, loading: false } // for final summary
   ```

## Integration Notes

When implementing this styling in the OpulentiaAI/SevenSearch repository:

1. Test thoroughly to ensure no functionality is lost
2. Keep responsive behavior for different screen sizes
3. Follow the Opulentia Color System neutral scale and World Blue brand colors consistently
4. Maintain backward compatibility with legacy styles where needed using the provided legacy classes
5. Consider gradually implementing changes to avoid breaking user expectations

By following this guide, you can achieve a polished, consistent interface that aligns with the Opulentia Design System while maintaining compatibility with the planned Mastra vNext backend improvements.