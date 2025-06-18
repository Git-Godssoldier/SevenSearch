# Q Search Setup Guide

This guide will help you set up and run the Q Search application locally.

## Prerequisites

- Node.js 18+ and Bun installed
- A Supabase account (already configured)
- API keys for various services

## Initial Setup

1. **Clone the repository**

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Environment Variables**
   - Ensure your `.env.local` file has all required variables:
     - Authentication: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `ENCRYPTION_SECRET`
     - Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
     - API Keys: `GEMINI_API_KEY`, `SCRAPYBARA_API_KEY`, `ANTHROPIC_API_KEY`, `EXA_API_KEY`, `FIRECRAWL_API_KEY`, `JINA_API_KEY`
     - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

4. **Database Setup**
   
   Option 1: Manual setup via Supabase SQL Editor
   - Log in to your Supabase dashboard
   - Go to the SQL Editor
   - Execute the SQL statements in `migrations/01_create_searches_table.sql`

   Option 2: Automatic setup (requires Node.js)
   ```bash
   node migrations/setup_database.js
   ```

## Running the Application

1. **Start the development server**
   ```bash
   bun run dev
   ```

2. **Access the application**
   Open your browser and navigate to http://localhost:3000

## Troubleshooting

### Database Issues
- If you encounter database errors, make sure your Supabase project is set up correctly and the SQL migrations have been applied.
- Check that your environment variables for Supabase are correct.

### API Key Issues
- If you encounter issues with external services (Gemini, Jina, Exa, etc.), verify that your API keys are valid and properly set in `.env.local`.
- Ensure the API keys have proper permissions and rate limits.

## Important Files

- `src/app/api/enhance-search/route.ts`: Main search API route with streaming response
- `src/lib/mastra-types.ts`: Custom Mastra SDK implementation
- `src/lib/mastra-steps/*.ts`: Individual workflow steps
- `src/lib/mastra-workflows/search-workflow.ts`: Main workflow orchestration

## Vercel Deployment

When deploying to Vercel:
1. Add all environment variables to your Vercel project settings
2. Make sure the Supabase database table exists
3. Set the build command to `bun run build`
4. Set the output directory to `.next`

## Key Features

### Streaming API Improvements

The application includes significant improvements to the streaming API to ensure compatibility with Vercel Edge Functions:

1. **TransformStream Usage**: 
   - Uses `TransformStream` instead of `ReadableStream` for better backpressure handling
   - Separates stream creation from stream processing for immediate response return

2. **Rate Limiting and Throttling**:
   - Implements throttled writes to prevent overwhelming the client
   - Ensures updates are properly spaced and controlled

3. **Error Handling**:
   - Adds comprehensive validation for API keys
   - Implements timeout handling for long-running workflows
   - Provides graceful error handling with proper client notifications

### Mastra Workflow Architecture

The application uses a custom Mastra workflow system that provides:

1. **Modular Design**:
   - Steps are defined as independent, reusable components
   - Workflows chain steps together with clear data flow

2. **Intelligent Query Handling**:
   - Automatically routes queries to either DeepSearch or traditional search paths
   - Uses AI to enhance original queries for better results

3. **Parallel Processing**:
   - Performs parallel searches across multiple providers (Exa, Jina)
   - Aggregates and deduplicates results for comprehensive coverage

4. **RAG Implementation**:
   - Uses embeddings to find the most relevant content
   - Applies semantic search to improve answer quality