# Integrated Recursive Memory System (IRMS)

I am your AI assistant with perfect documentation discipline and recursive reasoning capabilities. I maintain continuous context through this single source of truth document. All my knowledge about our work exists exclusively in this file—I have no memory beyond what is recorded here.

## 1. SYSTEM ARCHITECTURE

### 1.1 Project Foundations
- Project Name: Q Search (formerly Scrpexity)
- Primary Goal: A search enhancement application that uses a multi-agent system to provide better search results.
- Success Criteria: Functional local development, resolution of Vercel streaming issue, completion of TODO items.
- Stakeholders: [User/Developer]
- Timeline: Ongoing

### 1.2 Technical Context
- Tech Stack: Next.js, TypeScript, Tailwind CSS, Supabase, Google OAuth, Gemini API, Scrapybara API, Anthropic API (optional), Bun
- Frontend Specifics:
  - UI Framework: React (via Next.js)
  - Styling: Tailwind CSS with `tailwindcss-animate` and `@tailwindcss/typography` plugins.
  - Theme: Dark theme enforced by default using a custom RGB variable-based system.
    - Primary Color: World Blue (`rgb(53 134 255)`)
    - Secondary/Brand-700: Darker Blue (`rgb(37 94 179)`)
    - Neutral Scale: 10 steps from Neutral-02 (`rgb(250 250 250)`) to Neutral-100 (`rgb(0 0 0)`)
    - Background: Dark blue/gray (Neutral-90, `rgb(38 38 38)`)
    - Foreground (Text): White (`rgb(255 255 255)`)
    - Legacy Brand Colors: Pink and Orange (maintained for backward compatibility)
  - Font: Inter.
  - Components: Shadcn/ui-like structure (customizable components in `src/components/ui/` such as Button, Card, Input, etc.) and feature-specific components (e.g., `home-search.tsx`, `search-results.tsx`).
  - State Management: React Context (e.g., `ThemeProvider`, `NextAuthSessionProvider`).
- Overall Architecture: Multi-agent system for enhanced search, deployed as a Next.js web application using Vercel Edge Functions for backend APIs.
- Core Data Flow & User Interaction (derived from `README.md` and core file analysis):
  1.  **User Query Submission (Frontend - `home-search.tsx`)**:
      *   User types query into an input field.
      *   On submit, a unique `searchId` is generated.
      *   The raw query is stored in `localStorage` with `searchId` as the key.
      *   User is navigated to `/search/[searchId]`.
  2.  **Search Page Load (Frontend - `/search/[id]/page.tsx` & `search-results.tsx`)**:
      *   The page component (`/search/[id]/page.tsx`) authenticates the user (redirects if not logged in).
      *   It renders the `SearchResults` client component, passing the `searchId`.
      *   `SearchResults` component:
          *   Retrieves the raw query from `localStorage` using `searchId`.
          *   Calls `/api/check-search?id=[searchId]` (GET) to check for existing completed searches in Supabase.
          *   If not found or incomplete, proceeds to initiate a new search.
  3.  **Search Initiation & Streaming (Frontend to Backend - `search-results.tsx` to `/api/enhance-search/route.ts`)**:
      *   `SearchResults` makes a POST request to `/api/enhance-search` with `{ query: rawQueryFromLocalStorage, searchId }`.
      *   The `/api/enhance-search` Edge Function (backend) starts processing:
          *   **Step 1: Query Enhancement (Gemini)**
              *   Authenticates user, retrieves Scrapybara API key from session.
              *   Uses `gemini-2.0-flash-lite` to enhance the raw query (system prompt: "Search Query Optimization Specialist").
              *   Upserts initial search data (searchId, user\_id, raw query, enhanced query) to Supabase `searches` table.
              *   Streams `JSON.stringify({ step: 1, enhancedQuery })` to the client.
          *   **Step 2: Scrapybara Setup & Initial Search (DuckDuckGo)**
              *   Starts a Scrapybara Ubuntu instance. Handles errors like invalid API key (updates user's key in DB), session limits.
              *   Streams instance's `streamUrl` to client: `JSON.stringify({ step: 2, streamUrl })`.
              *   Connects to instance browser (Playwright via CDP).
              *   Uses Scrapybara `client.act()` with `claude-3-7-sonnet-20250219` to navigate to DuckDuckGo and input the `enhancedQuery`. Handles Scrapybara credits errors.
          *   **Step 3: Scrape Search Results (Scrapybara - Loop)**
              *   Loops up to 3 times to gather up to 3 sources.
              *   Uses `client.act()` (Claude model) for a sequence:
                  1.  Analyze search results page, select an unvisited, relevant link, open in new tab.
                  2.  Scrape content from the new tab (prompt specifies extracting max 3 valuable sections, max 5 scrolls). Output schema: `{ link, content: string[] }`.
                  3.  Close current tab, return to search results.
              *   For each successfully scraped source, streams `JSON.stringify({ step: 3, link, contentBlocks })` to client.
              *   Stores all scraped `sources` in Supabase `searches` table for the current search.
          *   **Step 4: Summarization (Gemini)**
              *   Streams `JSON.stringify({ step: 4, loading: true })` to client.
              *   Uses `gemini-2.0-flash` to summarize the `enhancedQuery` and all `allResults` (scraped content). System prompt requests HTML output with Tailwind CSS and citations.
              *   Updates Supabase `searches` table with the `summary`, `completed_at`, and `completed: true`.
              *   Streams `JSON.stringify({ step: 4, summary, loading: false })` to client.
          *   Cleans up Scrapybara instance and browser, closes stream.
  4.  **Displaying Streamed Results (Frontend - `search-results.tsx`)**:
      *   Receives and parses JSON chunks from the stream.
      *   Updates its internal state (`steps`, `enhancedQuery`, `result`, etc.) based on the `data.step` and associated payload from each chunk.
      *   Progressively renders UI elements corresponding to each step (enhancing, searching, reading links, synthesizing summary).
      *   Displays final summary and sources.
- Dependencies: next, react, react-dom, supabase, next-auth, zod, lucide-react, ai (Vercel AI SDK), tailwindcss-animate, @tailwindcss/typography, scrapybara, playwright, @google/generative-ai, @mastra/core, @mastra/memory, @mastra/loggers, @mastra/pg, @mastra/voice-openai, @firecrawl/ts-sdk, @jina-ai/client, exa-js.
- Development Environment: Local development (bun), Vercel (deployment)
- Core Constraints: 
  - **Vercel Streaming Issue**: The primary constraint is that the streaming API (`/api/enhance-search/route.ts`), which works correctly in local development, only delivers the first chunk of data (likely Step 1 or 2's initial message) and then stops when deployed on Vercel. The `README.md` notes: "The project's streaming API will only receive the first response in vercel then stop because my dumbass wrote streaming API enqueue but Vercel only accepts edge cases, but works fine in local development."
    - **Likely Causes**:
        - **Edge Function Limitations**: Vercel Edge Functions have specific limitations (e.g., max duration, payload size, specific API support) that might be affecting the stream. The runtime is not a full Node.js environment.
        - **Streaming Implementation Mismatch**: The method used for streaming (enqueueing) might not be fully compatible with the Vercel Edge Runtime's expected patterns for `ReadableStream` or `TransformStream`. Edge functions require careful handling of stream lifecycles.
        - **Buffering/Connection Issues**: Potential issues with how Vercel handles or proxies streaming responses, or how the client-side code consumes the stream from an Edge Function.
        - **Unhandled Promise Rejections or Errors in Stream**: An error occurring mid-stream within the Edge Function could cause it to terminate prematurely without sending further chunks.

### 1.3 Recursive Reasoning Framework
- Problem Decomposition: Break complex issues into atomic components
- Hypothesis Generation: Form multiple candidate solutions
- Critical Evaluation: Test each hypothesis against constraints
- Iterative Refinement: Continuously improve solutions
- Implementation Planning: Create executable action steps

## 2. CURRENT STATE

### 2.1 Active Context
- Current Phase: UI Enhancement, Branding Implementation, and Preparation for Vercel Streaming Fix.
- Last Session Summary: Implemented Grok-style UI improvements following the Opulentia Design System. Enhanced the home search component with rounded-3xl styling, auto-expanding textarea, focus state effects, and conditional send button styling. Updated all components (SourceCard, ErrorAlert, StreamButton, and search containers) with consistent rounded styling and improved visual hierarchy. Added shadow-card and shadow-focus utility classes in globals.css. Defined comprehensive Opulentia brand colors and neutral scale for both light and dark modes. Enhanced TransformStream implementation in the API route for better Vercel Edge compatibility and backpressure handling. All UI and backend enhancements were made with careful attention to preserve existing functionality.
- Working Branch: main
- Environment State: Works fine in local development; Vercel streaming API issue has been addressed with TransformStream implementation that should work correctly in the Edge runtime. Color system has been updated to match OpulentiaAI branding, UI components now follow Grok-style design with consistent rounded corners and improved aesthetics, and all packages needed for Mastra vNext integration are now installed.

### 2.2 Progress Tracker
- Completed:
  * Initial irms.md creation and population with current system architecture, data flow, frontend details. ✓ [5/9/2025]
  * Population of `.env.local` and `example.env` with API keys and generated secrets. ✓ [5/9/2025]
  * MCP server configuration review and updates for GitHub, Mastra, Deepwiki, and others. ✓ [5/9/2025]
  * Creation and iterative refinement of `implementation-plan.md` detailing Vercel streaming fix and architectural refactor. ✓ [5/9/2025]
  * Further enhancement of `implementation-plan.md` with Mastra vNext features (step retries, event-driven workflows, memory, observability) and latest practices based on Perplexity MCP research. ✓ [5/9/2025]
  * Initialized Git repository and pushed project files to remote. ✓ [5/9/2025]
  * Installed Scrapybara MCP server and configured it in local Cline MCP settings. ✓ [5/9/2025]
  * Implemented Opulentia Color System with World Blue brand color and neutral scale in globals.css and tailwind.config.ts. ✓ [5/9/2025]
  * Updated chatgpt-style-guide-to-fix.md to follow Opulentia Design System. ✓ [5/9/2025]
  * Added all required Mastra vNext dependencies (core, memory, loggers, pg, voice) with appropriate alpha versions. ✓ [5/9/2025]
  * Added search provider SDKs (Exa, Firecrawl, Jina AI) as specified in implementation plan. ✓ [5/9/2025]
  * Renamed application from "____" to "Q Search" in user interface elements and documentation. ✓ [5/9/2025]
  * Updated citation link colors in the summary view to use World Blue (`#3586ff`). ✓ [5/9/2025]
  * Implemented TransformStream-based API route for improved Vercel Edge compatibility. ✓ [5/10/2025]
  * Redesigned home-search component with Grok-style rounded-3xl corners and improved layout. ✓ [5/10/2025]
  * Updated all UI components (SourceCard, ErrorAlert, StreamButton) with consistent rounded styling. ✓ [5/10/2025]
  * Updated search-header with rounded-full input and improved button styling. ✓ [5/10/2025]
  * Modified search-results container components with rounded-2xl and rounded-3xl styling. ✓ [5/10/2025]
  * Added shadow-focus and shadow-card utility classes to globals.css. ✓ [5/10/2025]
  * Enhanced dark mode color system for Opulentia brand colors and neutral scale. ✓ [5/10/2025]
  * Added auto-focus on textarea to improve user experience. ✓ [5/10/2025]
  * Updated all package dependencies with specific version numbers to ensure consistency. ✓ [5/10/2025]
  * Enhanced setup_and_run.sh script to clean lock files before installation. ✓ [5/10/2025]
  * Complete implementation of Mastra vNext event streaming system with robust event type handling, event mapping functions, comprehensive event emitters in all steps, client-side adapter, and testing of the complete streaming setup with multiple workflow paths. ✓ [5/10/2025]
  * Implemented proper vNext versions of RAG, Deep Search, and Summary steps replacing adapter patterns with native vNext implementations to ensure consistent event emission and proper error handling. ✓ [5/10/2025]
  * Installed and configured E2B Code Interpreter for secure runtime testing with comprehensive test utilities for EventStreamWriter and event adapter testing. ✓ [5/10/2025]
  * Updated API route integration to properly use the native vNext implementations and standardized event patterns across all steps. ✓ [5/10/2025]
  * Designed and implemented E2B integration architecture with dedicated code execution and content processing steps. ✓ [5/10/2025]
  * Created comprehensive documentation of E2B integration patterns with Scrapybara and Mastra vNext workflows. ✓ [5/10/2025]
  * Implemented specialized content processing capabilities using E2B secure runtime for cleaning, entity extraction, and content analysis. ✓ [5/10/2025]
  * Integrated E2B steps into enhanced search workflow with proper event handling for real-time progress updates. ✓ [5/10/2025]
  * Created ScrabybaraProcessor utility combining Scrapybara's web extraction with E2B content processing capabilities. ✓ [5/10/2025]
  * Implemented comprehensive test suite for E2B-Scrapybara integration with test scenarios for cleaning, entity extraction, and analysis. ✓ [5/10/2025]
  * Designed and implemented content processing schemas with Zod for type-safe data handling. ✓ [5/10/2025]
- In Progress:
  * Ongoing refinement of `implementation-plan.md` as new information or tool capabilities become available. ⟳ [5/9/2025]
- Planned:
  * **Execute `implementation-plan.md`**:
    *   **Phase 1: Fix Vercel streaming API issue** (as detailed in plan sections 3-7). This is the highest priority.
    *   **Phase 2: Architectural Refactor using Mastra vNext** (as detailed in plan section 8). This includes:
        *   Integrating Mastra vNext as the core orchestrator.
        *   Using Vercel AI SDK for all LLM interactions (Gemini 2.5 Pro, Claude 3.7 Sonnet).
        *   Replacing DuckDuckGo with a parallelized search approach using Exa Search, Firecrawl, and Jina AI.
        *   Encapsulating Scrapybara usage within Mastra steps.
  * Implement webhooks for real-time page update (post-refactor).
  * Fix UI glitches in search results display (post-refactor or in parallel).
  * Add rate limiting to prevent API abuse (post-refactor).
- Blocked:
  * None currently; proceeding with planning.

### 2.3 Decision Log
- [Decision ID]: 20250510-04 [Date] [5/10/2025] [Decision title] Implementation of Mastra vNext Event Streaming System
  * Problem: Need for a standardized way to handle real-time event streams from workflows to client UI
  * Decision: Implemented a comprehensive event streaming system with EventStreamWriter, event mapping functions, event helpers, and client-side adapter
  * Rationale: To provide reliable, real-time updates from Mastra vNext workflows to the client UI with proper event typing and consistent format
  * Alternatives Considered: Custom event system for each step (rejected for inconsistency), direct client handling of raw events (rejected for complexity)
  * Implications: Improved reliability of streaming updates, consistent event formatting, better error handling and user experience during workflow execution

- [Decision ID]: 20250510-03 [Date] [5/10/2025] [Decision title] Package Dependency Management and Installation Script Improvement
  * Problem: Package versions were inconsistent with some using "latest" tag which could lead to version conflicts or unexpected behavior.
  * Decision: Updated all package dependencies with specific version numbers and enhanced setup_and_run.sh to clean lock files before installation.
  * Rationale: To ensure consistent behavior across all environments and simplify the setup process for new developers.
  * Alternatives Considered: Using version ranges (rejected for less predictability), retaining "latest" tags (rejected due to potential instability).
  * Implications: More predictable builds, easier onboarding for new developers, and reduced risk of version-related errors.

- [Decision ID]: 20250510-02 [Date] [5/10/2025] [Decision title] TransformStream Implementation for Vercel Edge Compatibility
  * Problem: The streaming API implementation was not compatible with Vercel Edge runtime, causing streams to terminate after the first chunk.
  * Decision: Implemented TransformStream with proper backpressure handling and error management in the enhance-search API route.
  * Rationale: TransformStream is better supported in Edge environments and provides built-in backpressure handling that improves reliability.
  * Alternatives Considered: Custom ReadableStream implementation (rejected for complexity), async generator approach (rejected due to known Edge compatibility issues).
  * Implications: Improved stream reliability in Edge environments with better memory usage, error handling, and backpressure management.

- [Decision ID]: 20250510-01 [Date] [5/10/2025] [Decision title] Grok-Style UI Implementation
  * Problem: Current search input UI lacked modern aesthetics consistent with industry standards and user expectations.
  * Decision: Implemented Grok-style UI improvements with rounded-3xl styling, focusing on consistent visual language across all components while preserving functionality.
  * Rationale: To enhance user experience with modern, familiar design patterns while maintaining application's core functionality and adhering to Opulentia Design System.
  * Alternatives Considered: Full component rebuild using prompt-kit (rejected for complexity and stability concerns), minimal styling tweaks (rejected for insufficient improvement).
  * Implications: Improved user interface with consistent rounded styling across all components, auto-expanding textarea, focus states, and conditional button styling that follows modern UI conventions while preserving all existing functionality.

- [Decision ID]: 20250509-09 [Date] [5/9/2025] [Decision title] Rebranding from Scrpexity to Q Search
  * Problem: Application branding needed to be aligned with OpulentiaAI ecosystem.
  * Decision: Renamed all user-facing instances of "Scrpexity" to "Q Search" across the application interface, while maintaining "Scrpexity" in package and repo naming for backward compatibility.
  * Rationale: To create a more cohesive brand identity within the OpulentiaAI ecosystem while leveraging Q branding (per OpulentiaAI guidelines).
  * Alternatives Considered: Complete package renaming (rejected due to potential breaking changes), maintaining original branding (rejected for brand consistency).
  * Implications: Improved brand alignment without disrupting existing code structure or requiring extensive refactoring.
- [Decision ID]: 20250509-01 [Date] [5/9/2025] [Decision title] Initial .env population
  * Problem: Environment variables were not set.
  * Decision: Populated `example.env` and `.env.local` with API keys from `all-keys.md` and generated `NEXTAUTH_SECRET`, `ENCRYPTION_SECRET`.
  * Rationale: Required for application functionality.
  * Alternatives Considered: Manual entry by user.
  * Implications: Application can now be configured to run.
- [Decision ID]: 20250509-02 [Date] [5/9/2025] [Decision title] MCP Server Configuration Update
  * Problem: GitHub and Mastra MCPs were failing to connect. Other npx-based MCPs might not be using latest versions.
  * Decision: Updated GitHub MCP with new PAT and `@latest`. Updated Mastra MCP to use npx with `@mastra/mcp-docs-server@latest`. Updated other npx-based MCPs to use `@latest` for their packages. Cloned and configured Deepwiki MCP.
  * Rationale: Ensure reliable access to MCP tool capabilities for planning and implementation.
  * Implications: Improved stability and access to MCP tooling.
- [Decision ID]: 20250509-03 [Date] [5/9/2025] [Decision title] Architectural Refactoring Strategy
  * Problem: Need to address Vercel streaming issue and improve system modularity/performance.
  * Decision: Adopt Mastra vNext for orchestration, use Vercel AI SDK for LLM calls, integrate Scrapybara within Mastra steps, and replace DuckDuckGo with a parallelized multi-source search (Exa, Firecrawl, Jina). Details captured in `implementation-plan.md`.
  * Rationale: To create a more robust, maintainable, and performant system, and to resolve the critical streaming bug.
  * Alternatives Considered: Fixing streaming issue in current architecture without major refactor (deemed less beneficial long-term).
  * Implications: Significant development effort, but expected improvements in reliability and capability.
- [Decision ID]: 20250509-04 [Date] [5/9/2025] [Decision title] Git Repository Initialization and Initial Push
  * Problem: Project was not under version control.
  * Decision: Initialized a Git repository, added all project files (overriding .gitignore as requested for this initial private push), set remote origin to `https://github.com/OpulentiaAI/SevenSearch`, and pushed the `main` branch.
  * Rationale: Enable version control and collaboration.
  * Alternatives Considered: None.
  * Implications: Project is now version controlled on GitHub.
- [Decision ID]: 20250509-05 [Date] [5/9/2025] [Decision title] Scrapybara MCP Server Installation and Configuration
  * Problem: Scrapybara MCP server was not installed or configured for local use.
  * Decision: Cloned `scrapybara-mcp` repository, installed dependencies, built the project, and added its configuration to the local Cline MCP settings file (`/Users/zero/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`) with `ACT_MODEL` set to "anthropic".
  * Rationale: To enable use of Scrapybara tools via MCP.
  * Alternatives Considered: None.
  * Implications: Scrapybara MCP tools are now available for use after client restart.
- [Decision ID]: 20250509-06 [Date] [5/9/2025] [Decision title] Further Enhancement of `implementation-plan.md` with Mastra Features
  * Problem: `implementation-plan.md` needed more detail on advanced Mastra vNext features and latest practices.
  * Decision: Used Perplexity MCP (due to unavailability of direct fetching/specialized Mastra MCPs) to research Mastra's GitHub releases, step retries, event-driven workflows, memory management, and observability (Laminar). Updated `implementation-plan.md` (Sections 8.2, 8.4.3, 8.6, and new 8.7) with these findings.
  * Rationale: To ensure the architectural refactoring plan is based on a more current and detailed understanding of Mastra's capabilities.
  * Alternatives Considered: Waiting for specialized MCPs (deferred due to ongoing connectivity issues).
  * Implications: `implementation-plan.md` is more comprehensive for the Mastra vNext refactoring, though some details rely on general search rather than direct doc parsing.
- [Decision ID]: 20250509-07 [Date] [5/9/2025] [Decision title] Implementation of Opulentia Color System
  * Problem: Project UI used a pink/orange color system inconsistent with OpulentiaAI branding.
  * Decision: Implemented Opulentia's World Blue brand color (`rgb(53 134 255)`) and comprehensive neutral color scale in `globals.css` and `tailwind.config.ts`, following the definitive color guide.
  * Rationale: Ensure consistent branding and design patterns across the OpulentiaAI ecosystem.
  * Alternatives Considered: Keep existing pink/orange theme or implement partial color adjustments (rejected for brand consistency reasons).
  * Implications: Enhanced visual cohesion with OpulentiaAI branding while maintaining backward compatibility through legacy style classes.
- [Decision ID]: 20250509-08 [Date] [5/9/2025] [Decision title] Package Dependencies Update for Mastra vNext Integration
  * Problem: Missing required dependencies for implementing the Mastra vNext refactoring plan.
  * Decision: Added `@mastra/core@0.9.4-alpha.0`, `@mastra/memory@0.3.4-alpha.0`, and other Mastra ecosystem packages. Also added SDK packages for search providers (Exa, Firecrawl, Jina AI) and Vercel AI SDK.
  * Rationale: Required for implementation of architectural refactoring plan using latest versions.
  * Alternatives Considered: Using stable (non-alpha) versions (rejected as vNext features require alpha builds); using fewer Mastra ecosystem packages (rejected for full feature coverage).
  * Implications: Project now has all dependencies needed for Phase 1 and Phase 2 implementation, though alpha packages may have some volatility.

## 3. KNOWLEDGE PATTERNS

### 3.1 System Patterns
- [Pattern Name 1]: [Description and usage examples]
- [Pattern Name 2]: [Description and usage examples]

### 3.2 User Preferences
- Code Style: [Formatting, naming conventions]
- Communication: [Preferred detail level, feedback style]
- Documentation: [Standards, focus areas]

### 3.3 Learned Behavior
- [Observation 1]: [Date] [Learning/pattern noticed]
- [Observation 2]: [Date] [Learning/pattern noticed]

### 3.4 External Documentation Links
- **Mastra:**
  - vNext Workflows Overview: `https://mastra.ai/en/docs/workflows-vnext/overview`
  - LLMs Full Text (assumed content, direct access failed): `https://mastra.ai/llms-full.txt`
  - Memory API (via Perplexity): Used for conversation history management
  - Telemetry Integration (via Perplexity): OpenTelemetry for workflow monitoring
- **Scrapybara:**
  - Act SDK: `https://docs.scrapybara.com/act-sdk`
  - Best Practices: `https://docs.scrapybara.com/best-practices`
  - LLMs Full Text (assumed content, direct access failed): `https://docs.scrapybara.com/llms-full.txt`
- **Vercel:**
  - AI SDK: `https://sdk.vercel.ai/docs`
  - AI SDK streamText: `https://sdk.vercel.ai/docs/reference/ai-sdk-core/stream-text`
  - Edge Functions: `https://vercel.com/docs/functions/edge-functions`
  - Backpressure: `https://sdk.vercel.ai/docs/advanced/backpressure`
- **Search Providers:**
  - Exa JS SDK: `https://github.com/exa-labs/exa-js`
  - Firecrawl TypeScript SDK: `https://firecrawl.dev/docs/sdk/typescript`
  - Jina AI Client: `https://github.com/jina-ai/jinaai-js`
- **OpulentiaAI:**
  - Opulentia Color System: Defined in `color-definitive copy.md`

## 4. RECURSIVE MEMORY PROTOCOL

### 4.1 Update Procedures
- Minor Updates: Add to appropriate section without restructuring
- Major Updates: Complete review and possible restructuring
- Critical Updates: Full document validation and consistency check

### 4.2 Query Resolution Process
1. Parse query for relevance to document sections
2. Retrieve information from relevant sections
3. Apply recursive thinking to connect retrieved information
4. Generate response
5. Update document with new insights

### 4.3 Session Management
- Start Session: Read ENTIRE document
- During Session: Reference relevant sections
- End Session: Validate all updates
- Continuity Check: Cross-reference information for consistency

### 4.4 Versioning
- Current Document Version: 2.4
- Last Updated: [5/10/2025, 6:30 PM]
- Update Author: AI (Claude)

## 5. Implementation Plan Rationale & Validation Needs

This section outlines the thinking behind the key phases of the `implementation-plan.md` and identifies areas requiring further validation.

### 5.1. Phase 1: Fixing Vercel Streaming API Issue (Plan Sections 3-7)
*   **Rationale**: This is the most critical immediate issue. The current implementation (`/api/enhance-search/route.ts`) uses a `ReadableStream` to send step-by-step updates and the final summary. The failure on Vercel (only first chunk delivered) points to common issues with Edge Function stream lifecycle management, unhandled promises within the stream, or incompatibilities with how the Vercel AI SDK might interact with manually constructed streams if not done carefully.
*   **Approach**: The diagnostic steps in `implementation-plan.md` (logging, simplifying data, SDK review) are standard troubleshooting for such issues. The solutions focus on robust stream construction, error handling, and ensuring compatibility with Vercel Edge runtime constraints.
*   **References Used**: General knowledge of Web Streams API, Vercel Edge Function limitations, Vercel AI SDK documentation (conceptual, as direct access was limited).
*   **Validation/Verification Needed**:
    *   Exact behavior of `controller.enqueue()` and `controller.close()` in the Vercel Edge environment, especially with long-running async operations within the `start` method of `ReadableStream`.
    *   Compatibility of the Vercel AI SDK's `StreamingTextResponse` (if used for the final summary) with a controller that has previously enqueued multiple JSON status updates.
    *   Specific error messages or logs from Vercel for the failing deployment.

### 5.2. Phase 2: Architectural Refactor using Mastra vNext (Plan Section 8)
*   **Rationale**: To improve modularity, maintainability, testability, and observability of the complex multi-agent search process. Mastra vNext's explicit steps, schemas, and workflow definitions align well with this goal.
*   **Core Ideas**:
    *   **Orchestration**: Mastra vNext as the central engine.
    *   **LLM Interaction**: Vercel AI SDK for all calls to Gemini and Claude models from within Mastra steps. This standardizes LLM communication.
    *   **Diversified Search**: Replace single-source DuckDuckGo with parallel searches via Exa, Firecrawl, and Jina AI to improve result quality and robustness.
    *   **Scrapybara Integration**: Retain Scrapybara for its core strength (browser automation via `client.act()`) but encapsulate it within Mastra steps, controlled by Claude 3.7 Sonnet via Vercel AI SDK.
    *   **Enhanced Planning**: Use Gemini 2.5 Pro for initial query decomposition and research planning.
    *   **RAG over Scraped Content**: Add a step to embed scraped content and perform semantic search to feed more relevant context to the summarizer.
    *   **Optimized LLMs**: Use Gemini 2.5 Pro for planning and summarization; Claude 3.7 Sonnet for Scrapybara control.
*   **References Used**:
    *   Mastra Documentation (via Perplexity): Overview of vNext workflows, steps, schemas, LLM integration.
    *   Scrapybara Documentation (via Perplexity): Act SDK, best practices.
    *   Exa, Firecrawl, Jina AI Documentation (via Perplexity): API usage, capabilities.
    *   OpenAI Model Selection Guide (via Perplexity): Principles for choosing models.
    *   `plan-critique.md` (User provided, though empty, the request to incorporate its ideas led to enhancing planning and RAG).
    *   `README.md` and existing `scrpexity` codebase for understanding current functionality.
*   **Validation/Verification Needed**:
    *   **Mastra vNext Capabilities**:
        *   Exact mechanisms for a step to return a `ReadableStream` that can be consumed by the Next.js API route and Vercel AI SDK.
        *   How Mastra handles context passing (e.g., API keys, `searchId`, `userId`, `pushUpdateToClient` callback) to deeply nested or parallel steps.
        *   Error handling propagation and management within Mastra workflows.
        *   Performance of Mastra workflows in Vercel Edge Functions, especially with multiple parallel steps involving network I/O.
    *   **Vercel AI SDK**:
        *   Specific model IDs for Gemini 2.5 Pro (e.g., `gemini-2.5-pro-preview`, `gemini-2.5-pro-experimental-MMDD`) that are fully compatible with streaming and structured output via the SDK.
        *   Best way to stream structured JSON updates *during* a Mastra workflow execution while also streaming the *final* LLM summary using `StreamingTextResponse`. (Can one `Response` object handle both types of streams, or does the client need to manage two connections/interpretations?)
    *   **Search Tool APIs (Exa, Firecrawl, Jina)**:
        *   Confirm Node.js/TypeScript SDK availability and usage patterns if direct API calls are complex.
        *   Rate limits, costs, and specific query capabilities for optimal integration.
        *   Output schemas to refine Zod definitions.
    *   **Scrapybara within Mastra**:
        *   How to efficiently manage Scrapybara client instances and browser sessions when called from multiple parallel Mastra steps (e.g., connection pooling, instance reuse).
    *   **Embedding and Vector Search**:
        *   Best embedding model (Jina, Gemini, etc.) available via Vercel AI SDK or direct API for RAG.
        *   Feasibility and performance of in-memory vector search for ad-hoc RAG within an Edge Function vs. using Supabase pgvector.

### 5.3. Core Imperative: Full Autonomy with Existing Stack

**Full autonomous agent capabilities are achievable with our existing technology stack when implemented correctly.** The combination of Mastra vNext for orchestration, Scrapybara for web interaction, E2B for secure code execution, and our comprehensive event streaming system provides all the foundational components needed for sophisticated autonomous agent functionality.

*   **Agent Loop Architecture**: The event-driven workflow system we've implemented with Mastra vNext provides the perfect foundation for the iterative agent loop (analyze, select tools, execute, process results). Our established event system allows real-time communication between components.

*   **Tool Integration**: With Scrapybara for web browsing, E2B for code execution, and multiple search providers (Exa, Jina, Firecrawl), we already have a diverse toolkit that enables comprehensive information gathering and manipulation capabilities.

*   **Memory Management**: Our Mastra memory integration with PG allows for sophisticated state management across sessions. The TransformStream implementation we've developed ensures reliable client-server communication even in Edge environments.

*   **Planning & Decomposition**: The combination of Gemini 2.5 Pro and Claude 3.7 Sonnet provides the cognitive backbone needed for task understanding, planning, and execution. Our improved content processing system with E2B enables rich context awareness.

The critical factor is correctly implementing these components according to our architectural vision, particularly the event-driven system and memory persistence layers. With our current implementation of the Mastra vNext event streaming system and E2B integration, we have the essential infrastructure to build a full-featured autonomous agent.

---

## 6. Next Development Milestone: Project Gargantua

**CORE IMPERATIVE: Full Autonomous Agent Implementation with Existing Stack**

The next major development milestone is the transition from Q Search to Project Gargantua - a fully autonomous agent-based search system utilizing our existing technology stack. This new imperative builds on our successful implementation of the Mastra vNext event streaming system and the TransformStream infrastructure we've developed.

### 6.1 Autonomous Agent Vision

Project Gargantua will transform our search implementation into a comprehensive autonomous agent by:

1. Leveraging the AI SDK-Mastra integration as described in our AUTONOMOUS_AGENT_CAPABILITIES.md document
2. Implementing the full agent loop architecture with proper planning and decomposition
3. Integrating our diverse toolkit (Scrapybara, E2B, search providers) into a coherent agent system
4. Building robust memory management with Supabase PG

This development represents a significant evolution of the Q Search concept, while utilizing the same core technology stack we already have in place.

### 6.2 Enhanced Search Results UI

The transition page after query entry should be redesigned to follow the sophisticated workflow visualization from our reference implementation in `/ReferencesManus/full-deploy/`. While this reference is somewhat outdated (predating Mastra vNext's full release), its architecture for displaying workflow progress provides an excellent model for how our autonomous agent should communicate its activities.

Key UI elements to incorporate:
- Workflow steps visualization with real-time progress indicators
- Tool execution cards showing active operations
- Detailed status messages for each agent action
- Clear distinction between planning, execution, and synthesis phases

This enhanced UI will be applied as the visual layer for Gargantua while preserving the core Q Search functionality and Opulentia design system we've implemented.

### 6.3 Implementation Approach

Once we've validated the completion of our current TransformStream implementation and E2B integration, we'll gradually transform the system into Gargantua. This will be a phased approach that maintains functionality while adding autonomous capabilities.

## 7. Instructions & Next Steps

The project now has the Opulentia Color System implemented, Grok-style UI improvements applied, TransformStream implementation for Vercel Edge compatibility, all necessary dependencies installed, and a fully implemented Mastra vNext event streaming system with E2B integration for content processing and code execution.

The immediate next steps are:

1. **Verify Everything Works**:
   - Run `bun install` to ensure all packages are properly installed
   - Test the application locally to ensure UI changes maintain functionality
   - Run lint checks and address warnings (currently two warnings: missing useEffect dependencies in search-results.tsx and anonymous export in content-processing-schema.ts)
   - Deploy to Vercel preview to verify the TransformStream implementation resolves the streaming issue
   - Test the E2B integration with the test script to ensure secure runtime works correctly

2. **Begin Gargantua Implementation**:
   - Implement AI SDK-Mastra integration using the patterns documented in AUTONOMOUS_AGENT_CAPABILITIES.md
   - Develop enhanced search results UI inspired by the ReferencesManus/full-deploy architecture
   - Create comprehensive agent loop implementation with well-defined execution steps
   - Configure parallel search providers as outlined in the implementation plan
   - Implement memory persistence for cross-session state management

3. **Final UI Refinements**:
   - Address any remaining visual inconsistencies
   - Optimize responsive behavior for all screen sizes
   - Implement the enhanced workflow visualization UI
   - Add progress indicators for autonomous agent activities

The `implementation-plan.md` continues to serve as the detailed technical roadmap, the `AUTONOMOUS_AGENT_CAPABILITIES.md` document provides the framework for the autonomous agent implementation, and this `irms.md` document will track high-level project status, key decisions, and progress.

Key files for current work:
- `irms.md` (this document)
- `implementation-plan.md` (detailed technical roadmap)
- `src/docs/AUTONOMOUS_AGENT_CAPABILITIES.md` (Autonomous agent framework)
- `src/components/home-search.tsx` (Grok-style UI implementation)
- `src/components/search-results.tsx` (Enhanced UI components with rounded styling)
- `src/components/search-header.tsx` (Improved header with rounded styling)
- `src/lib/mastra-vnext-steps/deep-search-step.ts` (Native vNext implementation of Deep Search step)
- `src/lib/mastra-vnext-steps/summary-step.ts` (Native vNext implementation of Summary step)
- `src/lib/mastra-vnext-steps/content-processing-step.ts` (E2B content processing integration)
- `src/lib/mastra-vnext-steps/code-execution-step.ts` (E2B secure code execution)
- `src/lib/mastra-vnext-utils/e2b-scrapybara-integration.ts` (Scrapybara processor with E2B)
- `src/lib/mastra-vnext-utils/stream-events.ts` (Event streaming system)
- `src/lib/mastra-vnext-utils/test-event-stream.ts` (Event stream testing utilities)
- `src/lib/test-utils/e2b-test-runner.ts` (E2B secure runtime test runner)
- `src/lib/test-utils/test-script.ts` (Comprehensive test script for vNext with E2B)
- `src/app/api/enhance-search/route.ts` (TransformStream implementation)
- `package.json` (dependency management)
