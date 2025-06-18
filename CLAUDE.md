# Scrpexity Development Guide

## Build Commands
- Build: `npm run build`
- Dev: `npm run dev` 
- Start: `npm run start`
- Lint: `npm run lint`
- Tests: Use E2B for tests - `node src/lib/test-utils/run-tests.ts` or `node src/lib/test-utils/run-all-evals.ts`

## Code Style
- **TypeScript**: Strict mode with interface-driven development
- **React**: Function components with 'use client' directive where needed
- **Paths**: Use aliases (@/components, @/lib) - see components.json
- **Naming**: PascalCase for components/interfaces, camelCase for variables/functions
- **Error Handling**: Try-catch for async, fallbacks for services
- **Components**: UI in @/components/ui, business logic in @/lib
- **State**: Prefer React hooks, use Context for global state
- **Testing**: E2B-based secure sandboxing with TypeScript test files

## Project Architecture
- Mastra vNext workflows for orchestration
- TypeScript monorepo with Next.js 15+
- Supabase for authentication and database
- shadcn/ui component system with Tailwind
- Path aliases defined in tsconfig.json and components.json

## Deployment Best Practices

### Authentication Bypass Pattern for Vercel Deployments

When deploying to Vercel, use this authentication bypass pattern to ensure the application remains functional even when authentication services fail:

1. **Environment Variable Control**
   - The AUTH_BYPASS_ENABLED environment variable controls authentication bypass behavior
   - Set in both local .env.local and Vercel project settings

2. **Middleware Simplification**
   - Disabling middleware with an empty export prevents authentication checks
   - `export {}` in middleware.ts is the simplest way to disable all middleware

3. **Public Authentication Provider**
   - Creating a credential-based public auth provider with fixed anonymous user details
   - Ensures consistent user identity for database operations

4. **Client-Side Mock Session**
   - Auto-detecting vercel.app deployments in SessionProvider and enabling mock sessions
   - Provides transparent fallback for users when authentication fails

5. **Static HTML Fallback**
   - Static HTML fallback pages in public/index.html provide a last resort when all else fails
   - Ensures users always see something rather than an error page

6. **Vercel Configuration**
   - Vercel.json rewrites can redirect authentication routes to the main page
   - Ensure environment variables are set directly in vercel.json

7. **Clean Build Process**
   - Remove package locks and caches for fresh deployments
   - Use --legacy-peer-deps for compatibility

For detailed implementation instructions, see docs/VERCEL_DEPLOYMENT.md.