# SevenSearch - Elite Multi-Engine AI Search Platform

> **Latest Update:** Complete interface transformation with clean, Zola.chat and Grok.com inspired design, HALO orchestration framework, and enterprise-grade performance monitoring.

## ✨ SevenSearch Interface Transformation

SevenSearch has been transformed into a **clean, elegant interface** inspired by leading AI platforms like Zola.chat and Grok.com while maintaining powerful multi-engine search capabilities.

### 🎨 **Dual Interface Design**

**Clean Mode (Zola.chat inspired):**
- Minimal landing state with centered search input
- Category pills (Web, Academic, Code)
- Auto-expanding textarea with smart suggestions
- Subtle animations without overwhelm

**Grok Mode (Grok.com inspired):**
- Professional input with smart feature pills
- Multi-Engine and AI Enhance buttons
- HALO Search model selector with tooltips
- Action buttons for enhanced functionality

### 🚀 **Advanced Architecture**

**HALO Orchestration Framework:**
- **Search Planner** - Intelligent query breakdown and engine selection
- **Provider Coordinator** - Multi-engine coordination with load balancing
- **Result Processor** - Real-time aggregation and deduplication  
- **Quality Verifier** - Comprehensive validation and scoring
- **Adaptive Optimizer** - Machine learning-based improvement

**Enterprise Performance Monitoring:**
- <23ms target response times
- Real-time metrics collection
- Prometheus export capabilities
- Quality scoring and recommendations
- Alert management and optimization

**Multi-Engine Integration:**
- Exa (semantic search)
- Jina AI (neural search)  
- Firecrawl (web crawling)
- Custom provider support

### 🔧 **Production Features**

- **Authentication Bypass** - Vercel deployment compatible
- **Real-time Streaming** - Progressive result delivery
- **Quality Assurance** - Multi-factor relevance scoring
- **Error Recovery** - Graceful fallback strategies
- **Component Integration** - Suna + Prompt-Kit + Motion Primitives + ChatGPT patterns

https://github.com/user-attachments/assets/e3569e07-02ce-4b2d-978c-e27ced6b6874

https://github.com/user-attachments/assets/371e8070-22c1-4700-b5f8-110fc3a4b9b6



## Quick Start

1. Install dependencies:
```bash
bun install
```

2. Set up environment variables:
```bash
cp example.env .env.local
```

3. Configure your `.env.local` file with the following variables:

## Environment Setup

### Authentication
- `NEXTAUTH_SECRET`: Generate a random string (e.g., using `openssl rand -base64 32`)
- `ENCRYPTION_SECRET`: Generate another random string for encryption (e.g., using `openssl rand -base64 32`)

### Google OAuth
1. Go to Google Cloud Console > Credentials
2. Create credentials > OAuth client ID
3. Application type: Web application
4. Name your application
5. Add Authorized JavaScript origins:
   - `http://localhost:3000` or `https://localhost:3000`
6. Add Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` or `https://localhost:3000/api/auth/callback/gooegl`
7. Copy the generated Client ID and Client Secret to:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

### API Keys
- `GEMINI_API_KEY`: Get from [Google AI Studio](https://aistudio.google.com/app/u/3/apikey)
- `SCRAPYBARA_API_KEY`: Get from [Scrapybara Dashboard](https://scrapybara.com/dashboard)
- `ANTHROPIC_API_KEY` (optional): If you want to use your own Anthropic API key

### Supabase Configuration
1. Create a Supabase project
2. Add to your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from project settings)
   - `SUPABASE_SERVICE_ROLE_KEY` (from project API settings)

## Database Setup

You can create the required tables automatically or run the SQL manually.

### Option&nbsp;1: Automated Script

Run the setup script to create any missing tables:

```bash
node migrations/setup_database.js
```

The script checks for the tables defined in the `migrations/` directory and
creates them using your Supabase service role key.

### Option&nbsp;2: Manual SQL

Open the Supabase SQL editor and apply the SQL files found in `migrations/` in
order (e.g. `01_create_searches_table.sql`, `02_create_suspended_workflows_table.sql`, ...).

The following snippets show the schema for the first two tables as an example:

#### Create users table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  email TEXT UNIQUE NOT NULL,
  encrypted_api_key TEXT
);
```

#### Create searches table
```sql
CREATE TABLE searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  searchId TEXT,
  query TEXT,
  enhanced_query TEXT,
  sources JSONB,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT FALSE
);
```

## Using Claude Instead of Scrapybara (Optional)

If you want to use your Anthropic API key directly, replace the following line in `src/app/api/enhance-search/route.ts(150:2)`:

```typescript
// From:
const anthro = anthropic({name: "claude-3-7-sonnet-20250219"});

// To:
const anthro = anthropic({
  name: "claude-3-7-sonnet-20250219",
  apikey: process.env.ANTHROPIC_API_KEY
});
```

Note: Using Claude directly is slower than normal Scrapybara calls, but it may not matter if you're running on a VM.

## How It Works

Scrpexity is a search enhancement application that uses a multi-agent system to provide better search results:

### User Flow
1. **Login & Authentication**:
   - User logs in using Google OAuth
   - Upon first login, user enters their Scrapybara API key
   - The API key is encrypted and stored in the database
   - During user session, the API key is passed to the session for client-side access

2. **Search Processing**:
   - User submits a query
   - The query is enhanced by Gemini 2.5 Flash Light to improve search relevance
   
3. **Multi-Agent Search System**:
   - First agent: Uses Scrapybara to enter the enhanced query into DuckDuckGo (preferred over Google for less AI filtering)
   - Looping through search results (3 iterations):
     - Agent 1: Opens the link
     - Agent 2: Reads and extracts content from the page
     - Agent 3: Closes the tab
   - Previous data is tracked to avoid revisiting the same links
   
4. **Results Compilation**:
   - All gathered information is fed to a summarizing agent
   - The agent creates a concise summary with proper citations
   
5. **Data Streaming & Storage**:
   - Results are streamed in real-time to the frontend
   - All search data is stored in the database for future reference
   
6. **Error Handling**:
   - Robust error handling for Scrapybara-related issues:
     - Low API credits
     - Session limits
     - Invalid card errors
     - And more for smooth user experience

The application uses streaming responses to show results in real-time, giving users immediate feedback as the search progresses.

## TODO

- [ ] Fix Vercel streaming API issue (currently only receives first response in production)
- [ ] Implement webhooks for real-time page update
- [ ] Fix UI glitches in search results display
- [ ] Add rate limiting to prevent API abuse
