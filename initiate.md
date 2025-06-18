# Initiating Work on Scrpexity

To effectively pick up and continue development on the Scrpexity project, please follow these essential steps:

1.  **Thoroughly Review `irms.md` (Integrated Recursive Memory System)**:
    *   This document is the project's single source of truth. It contains:
        *   System architecture, technical stack, and core data flow.
        *   Current project status, progress tracker, and active context.
        *   A detailed decision log capturing key architectural choices and their rationale.
        *   Links to external documentation and relevant knowledge patterns.
    *   Understanding `irms.md` is crucial for grasping the project's history, current state, and overall goals.

2.  **Comprehensively Study `implementation-plan.md`**:
    *   This file outlines the detailed strategy for addressing the primary Vercel streaming API issue and the planned architectural refactor to Mastra vNext.
    *   It includes diagnostic steps, potential solutions, and a phased approach to implementation, incorporating research on various services (Mastra, Vercel AI SDK, Exa, Firecrawl, Jina AI) and best practices.
    *   Pay close attention to Section 8, which details the Mastra vNext integration.

3.  **Examine Core Codebase Files**:
    *   To connect the documentation with the actual implementation, review the following key files (and others as referenced in `irms.md` or `implementation-plan.md`):
        *   **Backend Streaming Logic**: Likely `src/app/api/enhance-search/route.ts` (or `src/app/api/search/route.ts`). This is central to the Vercel streaming issue.
        *   **Frontend Search Initiation & Display**:
            *   `src/app/search/[id]/page.tsx`
            *   `src/components/search-results.tsx`
            *   `src/components/home-search.tsx`
        *   **Vercel AI SDK Usage**: Any files importing from the `ai` package.
    *   Analyze how the current streaming mechanism is implemented and where it might be failing on Vercel based on the descriptions in `irms.md` and `implementation-plan.md`.

4.  **Understand Original Issues**:
    *   Familiarize yourself with the primary problem: the streaming API works locally but fails on Vercel (only the first chunk is delivered). This is documented in `README.md` and detailed in `irms.md` (Core Constraints) and `implementation-plan.md` (Problem Statement).
    *   The goal is to understand these issues within the context of the *current, yet-to-be-refactored codebase* before proceeding with the changes outlined in the `implementation-plan.md`.

By following these steps, you will gain the necessary context to contribute effectively to the project, starting with Phase 1 (fixing the Vercel streaming issue) as outlined in the `implementation-plan.md`.
