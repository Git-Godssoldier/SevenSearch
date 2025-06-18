# Next-Generation Search Agent: Design and Implementation Plan

## 1. Introduction

This document outlines the design and implementation plan for a next-generation search agent. It builds upon the initial concepts presented in `currentimplementationplan.md` and `irms copy for manus.md`, and incorporates extensive research into advanced AI agent architectures, search technologies, and workflow orchestration frameworks. The goal is to create a state-of-the-art search agent that is powerful, flexible, scalable, and capable of deep research and synthesis.

This plan synthesizes learnings from:

*   **Jina AI:** Focusing on their expertise in neural search, embeddings, multimodal capabilities, and the `node-DeepResearch` agent architecture.
*   **Mastra VNext:** Leveraging its advanced workflow orchestration, agent management, flow control, and suspend/resume capabilities for building robust, stateful applications.
*   **Scrapybara (`scrpexity` project):** Analyzing its current implementation as a base for modernization and enhancement.
*   **Renschni Gist (Manus AI Agent Analysis):** Drawing insights from the technical breakdown of a highly autonomous AI agent, particularly its use of CodeAct, planning, and multi-LLM orchestration.

The aggregated research and extracted best practices are detailed in `advanced_patterns_best_practices.md`, which serves as a foundational reference for this design document.

## 2. Core Architectural Principles

The next-generation search agent will be built upon the following core architectural principles, derived from the comprehensive research phase:

*   **Iterative Reasoning Loop:** The agent will operate on an iterative "analyze -> plan -> execute -> observe" loop. This allows for dynamic task execution, adaptation to new information, and progressive refinement of results. (Inspired by Jina `node-DeepResearch`, Renschni Gist).
*   **Modular and Composable Design:** The system will be composed of distinct, reusable modules (agents, tools, services) orchestrated by a central workflow engine. (Inspired by Jina Executors, Mastra Steps).
*   **Workflow-Driven Orchestration:** Complex search and synthesis processes will be defined as explicit workflows, enabling clear logic, robust error handling, and advanced flow control (parallel execution, conditional branching, loops). (Mastra VNext).
*   **Sophisticated Planning and Task Decomposition:** A dedicated planning component will break down high-level user queries into actionable, multi-step plans. These plans will guide the workflow execution. (Inspired by Renschni Gist Planner Module, Jina `node-DeepResearch` query rewriting).
*   **Rich Toolset and Code-Activated Actions (CodeAct):** The agent will have access to a comprehensive suite of tools (web browser, shell, file system, data APIs, code interpreter). Actions will primarily be executed by generating and running code (Python) within a sandboxed environment, providing maximum flexibility. (Inspired by Renschni Gist CodeAct, Jina `node-DeepResearch` tools).
*   **Sandboxed Execution Environment:** All agent actions, especially code execution and web browsing, will occur within a secure, isolated sandbox (e.g., Docker container) to ensure safety and prevent unintended side effects. (Inspired by Renschni Gist, general best practices).
*   **Advanced Search and Embedding Strategy:** The agent will leverage state-of-the-art embedding models for semantic understanding of queries and content. It will support multimodal search where applicable and employ techniques for relevance ranking and information extraction. (Jina AI).
*   **Retrieval-Augmented Generation (RAG):** The agent will actively fetch and incorporate external knowledge from various sources: structured data APIs (prioritized), curated knowledge bases, and general web content. (Inspired by Renschni Gist, Jina AI Datasources).
*   **Schema-Driven Development:** All data interfaces between components, LLM interactions, and tool inputs/outputs will be strictly defined and validated using schemas (e.g., Zod), ensuring data integrity and reliability. (Inspired by Mastra VNext, Jina `node-DeepResearch`).
*   **Multi-LLM Strategy (Optional but Recommended):** Consider leveraging multiple LLMs, choosing the best model for specific sub-tasks (e.g., reasoning, coding, summarization, query enhancement) to optimize performance and capabilities. (Inspired by Renschni Gist).
*   **Persistent Memory and State Management:** The agent will maintain persistent memory of its tasks, progress, intermediate findings, and learned information. This includes a `todo.md`-style checklist and structured data storage. Mastra VNext workflows inherently support state persistence and resumption. (Inspired by Renschni Gist, Mastra VNext).
*   **User-Centric Interaction and Streaming:** The agent will provide real-time feedback and stream results to the user interface, enhancing the user experience. Suspend/resume capabilities will allow for human-in-the-loop interactions. (Inspired by `scrpexity` goals, Mastra VNext, Vercel AI SDK).

## 3. Proposed Next-Generation Search Agent Architecture

This section details the proposed architecture, building upon the `scrpexity` foundation and the user-provided `currentimplementationplan.md`, modernized with the principles and technologies researched.

### 3.1. Overall System Diagram (Conceptual)

```
+-----------------------+      +-----------------------+      +-----------------------+
|   User Interface      |----->|   API Gateway /       |<---->|   Orchestration Engine|
| (Next.js, Vercel AI)  |      |   Backend (Next.js)   |      |    (Mastra VNext)     |
+-----------------------+      +-----------------------+      +-----------------------+
          ^                                                            |
          | (Streaming UI Updates)                                       | (Workflow Definitions,
          |                                                              |  Step Execution)
          |                                                            V
+------------------------------------------------------------------------------------------+
|                                   Agent Core & Sandbox                                   |
|------------------------------------------------------------------------------------------|
| +-----------------+  +-----------------+  +-----------------+  +-----------------------+ |
| | Planner Module  |  | Reasoning Engine|  | Memory System   |  | Tool Execution Engine | |
| | (LLM-driven)    |  | (LLM - Claude, |  | (Files, DB,     |  | (Python Sandbox)      | |
| |                 |  |  Gemini, etc.)  |  |  Vector Store)  |  |                       | |
| +-----------------+  +-----------------+  +-----------------+  +-----------------------+ |
|         |                   |                   |                   |                      |
|         | (Task Plan)       | (Action Code)     | (RAG, State)      | (Tool Calls)         |
|         V                   V                   V                   V                      |
| +--------------------------------------------------------------------------------------+ |
| |                                     Tool Suite                                     | |
| |--------------------------------------------------------------------------------------| |
| | Browser (Playwright) | Shell (Bash) | File System | Code Interpreter | Data APIs | ... | |
| +--------------------------------------------------------------------------------------+ |
+------------------------------------------------------------------------------------------+
```

### 3.2. Components Deep-Dive

**A. User Interface (UI) and API Gateway:**
*   **Technology:** Next.js, Vercel AI SDK for streaming and LLM interactions on the client/edge.
*   **Functionality:**
    *   Accepts user queries and displays results.
    *   Streams real-time progress and intermediate findings.
    *   Handles user authentication (as in `scrpexity`).
    *   Provides an interface for managing API keys (securely, as in `scrpexity`).
    *   Communicates with the backend API Gateway to initiate and monitor search tasks.
*   **Modernization from `scrpexity`:** Improve streaming reliability (addressing Vercel edge limitations, potentially by using Mastra VNext state updates to trigger UI refreshes or by carefully managing stream lifecycles).

**B. Orchestration Engine (Mastra VNext):**
*   **Technology:** Mastra VNext.
*   **Functionality:**
    *   Defines and executes the main search and synthesis workflows.
    *   Manages the sequence of operations: query processing, planning, iterative research (search, scrape, extract), summarization, and result formatting.
    *   Each logical operation will be a Mastra `Step` with defined Zod schemas for input, output, and potential suspension/resumption.
    *   Leverages Mastra’s flow control (parallel, branch, loop) for dynamic and efficient execution.
    *   Handles state persistence for long-running tasks and enables suspend/resume for human-in-the-loop scenarios (e.g., user clarifies ambiguous query, selects relevant sources).
*   **Integration:** The Next.js backend will trigger Mastra workflows and subscribe to their state changes or outputs.

**C. Agent Core & Sandbox:**

    **C.1. Planner Module:**
    *   **Technology:** LLM-driven (e.g., Claude Haiku or a fine-tuned model for planning).
    *   **Functionality:** Receives the initial user query (potentially enhanced by another LLM call). Decomposes the query into a structured, multi-step research plan (similar to `todo.md` but more dynamic). This plan is fed into the Mastra workflow as initial data or context.
    *   **Output:** A list of research questions, keywords, types of information to find, and potential sources or strategies.

    **C.2. Reasoning Engine (LLM Backbone):**
    *   **Technology:** Primary LLM (e.g., Claude 3.5/3.7 Sonnet/Opus, Gemini Advanced) for core reasoning, action generation (CodeAct), and synthesis.
    *   **Functionality:**
        *   Analyzes the current step in the plan and the available information (from memory/observation).
        *   Generates Python code (CodeAct) to select and use tools from the Tool Suite to achieve the current sub-goal.
        *   Evaluates the results of tool execution.
        *   Synthesizes information from multiple sources.
        *   Decides when a sub-task is complete or if further iteration is needed.
        *   Generates the final summary and citations.
    *   **System Prompt:** A detailed system prompt will guide the LLM, defining its role, the iterative loop, available tools (with schemas), output format expectations, and operational constraints.

    **C.3. Memory System:**
    *   **Technology:** Combination of:
        *   **File-based:** For `todo.md` (task checklist, updated by the agent), logs, and intermediate text artifacts.
        *   **Database (Supabase):** For structured storage of search sessions, user data, processed results, and potentially API keys (encrypted, as in `scrpexity`).
        *   **Vector Store (e.g., integrated with Supabase or a dedicated service like Pinecone/Weaviate via Jina AI tools):** For storing embeddings of scraped content, enabling semantic search over gathered information and long-term memory/knowledge retention.
    *   **Functionality:** Provides short-term (working memory for current task) and long-term memory (knowledge from past tasks, cached results).

    **C.4. Tool Execution Engine:**
    *   **Technology:** Secure Python execution sandbox (e.g., Docker container with restricted permissions, or a dedicated sandboxing library).
    *   **Functionality:** Receives Python code generated by the Reasoning Engine and executes it. Returns the output (stdout, stderr, files) or any errors back to the Reasoning Engine for observation.

    **C.5. Tool Suite:**
    *   **Browser Interaction:** (e.g., Playwright, as used by Manus in the Gist and by `scrpexity` via Scrapybara). For navigating web pages, extracting content, clicking elements, filling forms.
        *   *Modernization:* Directly integrate Playwright or a similar library controlled by generated Python code, rather than relying solely on Scrapybara if more fine-grained control is needed. Scrapybara can still be a tool for simpler scraping tasks.
    *   **Web Search:** Tools to query multiple search engines (DuckDuckGo, Google, BraveSearch, Serper, etc., as seen in Jina `node-DeepResearch`).
    *   **Shell Access:** For running system commands, scripts (within the sandbox).
    *   **File System Access:** For reading/writing files, managing data within the agent’s workspace.
    *   **Code Interpreter:** The Python sandbox itself. Potentially Node.js if needed for specific tasks.
    *   **Data APIs:** Python clients for interacting with pre-approved external data APIs (weather, finance, academic papers, etc.). Jina AI’s `Datasource` concept is relevant here.
    *   **Embedding Generation Tool:** Python client to call embedding models (Jina AI hosted, OpenAI, local models).
    *   **Text Processing Tools:** For cleaning HTML, parsing Markdown, extracting specific information patterns (similar to Jina `node-DeepResearch` text-tools).
    *   **Evaluation Tool:** An LLM-driven tool to assess the quality of information, relevance of sources, or completeness of answers at intermediate steps.

### 3.3. Workflow Example: Handling a Complex Research Query

User Query: "What are the latest advancements in quantum-resistant cryptography and their potential impact on blockchain technology? Provide a summary with key challenges and future outlook."

1.  **Initiation (UI -> API Gateway -> Mastra):**
    *   User submits query.
    *   Next.js backend triggers a Mastra workflow (e.g., `DeepResearchWorkflow`).

2.  **Planning Step (Mastra Step -> Planner Module):**
    *   Planner LLM receives the query.
    *   Generates a research plan:
        1.  Define "quantum-resistant cryptography (QRC)" and "blockchain technology."
        2.  Search for recent (past 1-2 years) advancements in QRC (algorithms, implementations).
        3.  Search for analyses of QRC impact on blockchain (security, performance, adoption).
        4.  Identify key challenges in implementing QRC for blockchain.
        5.  Identify future outlook and research directions.
        6.  Synthesize findings into a structured summary.
    *   This plan is stored in the workflow context and/or a `todo.md` file.

3.  **Iterative Research Loop (Mastra Loop construct containing multiple Steps):
    For each sub-task in the plan (e.g., "Search for recent advancements in QRC")**:
    *   **Action Generation Step (Mastra Step -> Reasoning Engine):**
        *   Reasoning LLM reviews the current sub-task and existing knowledge.
        *   Generates Python code to use the `WebSearchTool` (e.g., `search_tool.execute(query="latest advancements quantum-resistant cryptography 2023-2024", num_results=5)`).
    *   **Tool Execution Step (Mastra Step -> Tool Execution Engine):**
        *   The Python code is executed in the sandbox.
        *   Search results (URLs, snippets) are returned.
    *   **Content Extraction Sub-Loop (Mastra Loop within the main loop):
        For each promising URL:**
        *   **Action Generation (Reasoning Engine):** Generates Python code to use `BrowserTool` (e.g., `browser_tool.scrape_text(url="...")`).
        *   **Tool Execution (Tool Execution Engine):** Scrapes content.
        *   **Data Processing & Embedding (Reasoning Engine + Tools):** Generates code to clean text, extract key info, and generate embeddings. Stores processed content and embeddings in Memory System (Vector Store, Files).
    *   **Evaluation Step (Mastra Step -> Reasoning Engine + Evaluation Tool):**
        *   Reasoning LLM (or a specialized evaluator LLM) assesses if enough relevant information for the current sub-task has been gathered.
        *   If not, may trigger query rewriting, further searches, or deeper dives into specific sources.

4.  **Synthesis Step (Mastra Step -> Reasoning Engine):**
    *   Once all sub-tasks in the plan are sufficiently addressed, the Reasoning LLM retrieves all relevant processed information from the Memory System (leveraging semantic search over embeddings).
    *   Generates a comprehensive summary, addressing all aspects of the original query, including challenges and future outlook, with citations to the sources used.

5.  **Result Delivery (Mastra -> API Gateway -> UI):**
    *   The final synthesized report is passed back through the Mastra workflow output.
    *   The Next.js backend streams the final result to the UI.
    *   The entire session (query, plan, sources, summary) is saved in Supabase.

## 4. Modernizing `scrpexity`

The current `scrpexity` project provides a good starting point. Modernization will involve refactoring and extending its capabilities based on the architecture above:

*   **Integrate Mastra VNext:** Introduce Mastra as the central orchestrator for the multi-agent search process. The existing agent logic (query enhancement, search, scrape, summarize) will be broken down into Mastra `Steps`.
    *   *Reference:* `advanced_patterns_best_practices.md` - Section IV.1.
*   **Enhance Agent Capabilities with CodeAct:** Instead of fixed agent roles, the Mastra steps will invoke the Reasoning LLM to generate Python code for tool interactions. This makes agents more dynamic and powerful.
    *   *Reference:* `advanced_patterns_best_practices.md` - Section V.7.
*   **Adopt a More Sophisticated Planning Module:** Replace or augment the current Gemini query enhancement with a dedicated planning step that generates a multi-step research plan.
    *   *Reference:* `advanced_patterns_best_practices.md` - Section V.4.
*   **Implement an Iterative Reasoning Loop:** Move beyond a fixed number of search iterations. The Mastra workflow will implement a loop controlled by an evaluation step to determine if more research is needed.
    *   *Reference:* `advanced_patterns_best_practices.md` - Section IV.2.
*   **Expand Tool Suite and Direct Control:** While Scrapybara can remain a tool, integrate direct Playwright control for more complex browsing tasks. Add more search tools, text processing tools, and an evaluation tool.
    *   *Reference:* `advanced_patterns_best_practices.md` - Section IV.3.
*   **Introduce Semantic Search and Embeddings:** Integrate embedding generation for scraped content and use a vector store for semantic search over gathered information, improving summarization quality and enabling RAG from the agent’s own findings.
    *   *Reference:* `advanced_patterns_best_practices.md` - Section IV.4.
*   **Robust State and Memory Management:** Leverage Mastra’s state persistence and expand `scrpexity`’s Supabase storage to include more detailed session data, plans, and potentially cached/embedded content.
    *   *Reference:* `advanced_patterns_best_practices.md` - Section V.6.
*   **Schema Enforcement:** Introduce Zod schemas for all Mastra step inputs/outputs and LLM interactions.
    *   *Reference:* `advanced_patterns_best_practices.md` - Section II.5, III.1.
*   **Address Vercel Streaming:** Carefully design the interaction between Mastra workflow outputs and the Next.js frontend using Vercel AI SDK to ensure reliable streaming.
    *   *Reference:* `advanced_patterns_best_practices.md` - Section IV.7.

## 5. Phased Implementation Plan

**Phase 1: Core Orchestration and Agent Setup**
1.  Set up Mastra VNext environment.
2.  Develop basic Next.js backend to trigger a simple Mastra workflow.
3.  Implement the core Reasoning Engine (LLM interaction) as a Mastra step.
4.  Set up the secure Python Tool Execution Engine (sandbox).
5.  Integrate basic tools: Web Search (e.g., DuckDuckGo via a simple script) and Browser Scrape (e.g., basic Playwright script).
6.  Create an initial version of the Planner Module (LLM-driven query-to-plan).
7.  Develop a minimal `todo.md` or file-based state tracking within Mastra steps.
8.  *Goal:* Agent can take a simple query, generate a plan, execute one search, scrape one page, and return raw content.

**Phase 2: Iterative Research and Enhanced Tooling**
1.  Implement the iterative research loop in Mastra (looping through plan steps, then looping for content extraction).
2.  Integrate more advanced search tools (multiple engines, result ranking).
3.  Enhance browser tool for more robust scraping and interaction.
4.  Develop text processing and cleaning tools.
5.  Implement an initial Evaluation Tool/Step to guide the iterative loop.
6.  Integrate Supabase for storing session data and results (extending `scrpexity`’s setup).
7.  *Goal:* Agent can execute a multi-step plan, scrape multiple pages, and store structured intermediate results.

**Phase 3: Summarization, Embeddings, and UI Integration**
1.  Develop the Summarization Agent/Step using an LLM.
2.  Integrate embedding generation for scraped content.
3.  Set up a vector store and implement semantic search over gathered content for RAG during summarization.
4.  Refine UI (Next.js) for better display of structured results, sources, and streaming updates (Vercel AI SDK).
5.  Implement robust error handling within Mastra workflows.
6.  *Goal:* Agent can perform deep research on a topic, synthesize findings into a cited summary, and stream results to the UI.

**Phase 4: Advanced Features and Optimization**
1.  Implement suspend/resume capabilities in Mastra for human-in-the-loop interactions.
2.  Explore multi-LLM orchestration for specialized tasks.
3.  Develop more sophisticated long-term memory and knowledge base integration.
4.  Optimize performance, scalability, and cost of LLM calls and tool usage.
5.  Conduct extensive testing and prompt engineering for reliability.
6.  *Goal:* A robust, highly capable, and optimized search agent.

## 6. Testing and Validation Strategy

*   **Unit Testing:** Each Mastra `Step`, tool, and utility function should have unit tests.
*   **Integration Testing:** Test the interaction between Mastra steps, the Reasoning Engine, and the Tool Execution Engine.
*   **Workflow Testing:** Test entire Mastra workflows with various types of queries (simple, complex, ambiguous).
*   **End-to-End Testing:** Test the full system from UI query submission to result display.
*   **Performance Testing:** Evaluate response times, resource usage, and scalability under load.
*   **Robustness Testing:** Test error handling, recovery from tool failures, and behavior with unexpected inputs.
*   **Qualitative Evaluation:** Assess the quality, relevance, and comprehensiveness of search results and summaries for a diverse set of research tasks. User feedback will be crucial here.
*   **Security Testing:** Ensure the sandboxed environment is secure and that API key management is robust.

## 7. Key Technologies and Dependencies

*   **Orchestration:** Mastra VNext
*   **Frontend/Backend API:** Next.js
*   **UI Streaming/LLM Client:** Vercel AI SDK
*   **Primary LLMs:** Claude series (Anthropic), Gemini series (Google), or other powerful models.
*   **Database:** Supabase (PostgreSQL)
*   **Vector Store:** Supabase pgvector, Pinecone, Weaviate, or Jina AI managed embeddings.
*   **Browser Automation:** Playwright
*   **Sandboxing:** Docker (or similar containerization/sandboxing libraries for Python).
*   **Schema Validation:** Zod
*   **Programming Languages:** TypeScript (primarily for Next.js, Mastra), Python (for Tool Execution Engine, agent scripts, LLM interactions if not using Vercel SDK directly for all).
*   **Search APIs:** DuckDuckGo, Serper, Google Search API, etc.
*   **Embedding Models:** Jina AI Embeddings, OpenAI Ada, Sentence Transformers, etc.

## 8. References

*   User-provided: `currentimplementationplan.md`, `irms copy for manus.md`.
*   This project: `/home/ubuntu/advanced_patterns_best_practices.md` (contains detailed citations to Jina AI docs, Mastra VNext docs, `node-DeepResearch` GitHub, Renschni Gist).
*   Jina AI Documentation: `https://docs.jina.ai/`
*   Jina AI `node-DeepResearch`: `https://github.com/jina-ai/node-DeepResearch`
*   Mastra VNext Documentation: `https://mastra.ai/docs/` (specifically workflows-vnext sections)
*   Scrapybara (`scrpexity`): `https://github.com/Bhavya031/scrpexity`
*   Renschni Gist (Manus AI Analysis): `https://gist.github.com/renschni/4fbc70b31bad8dd57f3370239dccd58f`

This document provides a comprehensive roadmap for developing the next-generation search agent. It emphasizes a modular, workflow-driven, and AI-powered approach to tackle complex research tasks effectively.
