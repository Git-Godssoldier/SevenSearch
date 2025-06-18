# Vercel Deployment Guide for Q Search

This document outlines the configuration requirements and best practices for deploying the Q Search application to Vercel production environments.

## Overview

Q Search is built using Next.js with TypeScript and leverages Edge Functions for streaming API responses. This guide provides the necessary configuration for deploying the application to Vercel, focusing on environment setup, Edge Functions configuration, and streaming API optimization.

## Deployment Configuration

### Basic Setup

1. **Project Connection**
   - Connect your GitHub repository to Vercel
   - Select the repository and configure the project settings

2. **Framework Preset**
   - Vercel automatically detects Next.js
   - Framework preset: Next.js

3. **Root Directory**
   - Project root: `.`

4. **Build and Output Settings**
   - Build command: `npm run build`
   - Output directory: `.next`
   - Install command: `npm install`

### Environment Variables

Q Search requires the following environment variables for proper functionality:

```
# Authentication
NEXTAUTH_SECRET=<your-generated-secret>
NEXTAUTH_URL=https://your-production-domain.com

# Database
POSTGRES_PRISMA_URL=<your-postgresql-connection-string>
POSTGRES_URL_NON_POOLING=<your-postgresql-direct-connection>

# API Keys
GEMINI_API_KEY=<your-gemini-api-key>
CLAUDE_API_KEY=<your-claude-api-key>
SCRAPYBARA_API_KEY=<your-scrapybara-api-key>
EXA_API_KEY=<your-exa-search-api-key>
JINA_API_KEY=<your-jina-ai-api-key>
FIRECRAWL_API_KEY=<your-firecrawl-api-key>
E2B_API_KEY=<your-e2b-api-key>

# Feature Flags
ENABLE_E2B_TESTING=true
ENABLE_RECURSIVE_IMPROVEMENT=true
```

**Notes on Environment Variables:**
- All API keys must be set before the build process
- `NEXT_PUBLIC_` prefix is required for client-side environment variables
- For Edge Functions, environment variables are limited to 64KB
- Sensitive variables like API keys are never exposed to the client

### Edge Function Configuration

Edge Functions are used for the streaming APIs in Q Search, particularly for the `/api/enhance-search` endpoint. To ensure proper functionality, add the following configuration to your `vercel.json` file:

```json
{
  "functions": {
    "src/app/api/enhance-search/route.ts": {
      "runtime": "edge",
      "memory": 1024,
      "maxDuration": 30
    },
    "src/app/api/check-search/route.ts": {
      "runtime": "edge"
    },
    "src/app/api/setup-api-key/route.ts": {
      "runtime": "nodejs18.x"
    },
    "src/app/api/auth/**/*.ts": {
      "runtime": "nodejs18.x"
    }
  },
  "routes": [
    {
      "src": "/api/enhance-search(/?.*)",
      "dest": "/api/enhance-search",
      "headers": {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Transfer-Encoding": "chunked"
      }
    }
  ]
}
```

### Streaming Response Optimization

To optimize streaming responses from Edge Functions:

1. **TransformStream Configuration**:
   The `/api/enhance-search/route.ts` file uses a TransformStream for handling backpressure and transforming events to client-friendly updates:

   ```typescript
   export async function POST(req: Request) {
     // Create a TransformStream to handle backpressure
     const { readable, writable } = new TransformStream();
     
     // Process the request and stream the response
     const requestData = await req.json();
     const { query, searchId } = requestData;
     
     // Start the streaming process in the background
     streamSearch(query, searchId, writable).catch((error) => {
       console.error("Streaming error:", error);
     });
     
     // Return the readable stream as the response
     return new Response(readable, {
       headers: {
         "Content-Type": "text/event-stream",
         "Cache-Control": "no-cache, no-store, must-revalidate",
         "Connection": "keep-alive"
       }
     });
   }
   ```

2. **Error Handling**:
   Ensure proper error handling in the streaming process to prevent Edge Function termination:

   ```typescript
   async function streamSearch(query: string, searchId: string, writable: WritableStream) {
     const writer = writable.getWriter();
     const encoder = new TextEncoder();
     
     try {
       // Stream processing logic
       // ...
     } catch (error) {
       // Log the error but don't throw
       console.error("Error in streamSearch:", error);
       
       // Send error message to client
       const errorMessage = JSON.stringify({
         error: true,
         message: "Search processing failed",
       });
       await writer.write(encoder.encode(errorMessage));
     } finally {
       // Always close the writer
       await writer.close();
     }
   }
   ```

### Deployment Regions

For optimal performance, deploy the application to multiple regions:

```json
{
  "regions": ["iad1", "sfo1", "lhr1"]
}
```

This configuration deploys to US East (N. Virginia), US West (San Francisco), and Europe (London).

## Production Monitoring

Vercel provides built-in monitoring for production deployments:

1. **Analytics**:
   Enable Vercel Analytics to track performance metrics, user sessions, and errors.

2. **Edge Function Logs**:
   Access Edge Function logs through the Vercel dashboard for troubleshooting.

3. **Custom Alerts**:
   Configure alerts for critical errors or performance thresholds.

## Performance Optimization

To ensure optimal performance in production:

1. **Edge Middleware**:
   Use Edge Middleware for caching and request optimization:

   ```typescript
   // src/middleware.ts
   import { NextResponse } from 'next/server';
   import type { NextRequest } from 'next/server';
   
   export function middleware(request: NextRequest) {
     // Cache static assets longer
     if (request.nextUrl.pathname.startsWith('/assets/')) {
       const response = NextResponse.next();
       response.headers.set('Cache-Control', 'public, max-age=86400');
       return response;
     }
     
     return NextResponse.next();
   }
   
   export const config = {
     matcher: [
       '/assets/:path*',
       '/api/:path*',
     ],
   };
   ```

2. **Response Compression**:
   Enable response compression for improved performance:

   ```json
   {
     "headers": [
       {
         "source": "/(.*)",
         "headers": [
           { "key": "Content-Encoding", "value": "br" }
         ]
       }
     ]
   }
   ```

## CI/CD Integration

Configure CI/CD integration with GitHub:

1. **Preview Deployments**:
   Vercel automatically creates preview deployments for pull requests.

2. **Branch Protection**:
   Enable branch protection rules for the main branch, requiring successful builds.

3. **Environment Configuration**:
   Configure separate environments for staging and production.

## Troubleshooting

If you encounter deployment issues:

1. **Check Logs**:
   Review build and runtime logs in the Vercel dashboard.

2. **Verify Environment Variables**:
   Ensure all required environment variables are properly set.

3. **Test Edge Functions**:
   Validate Edge Function behavior with simple test routes.

4. **Check Streaming Responses**:
   Verify that streaming responses are properly configured and not timing out.

## Conclusion

By following this deployment guide, you can ensure a smooth deployment of Q Search to Vercel production environments. The configuration settings provided optimize Edge Function performance, streaming responses, and overall application reliability.

For technical support or questions, please contact the development team at support@opulentiaai.com.