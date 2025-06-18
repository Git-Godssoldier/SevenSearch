# Vercel Production Environment Configuration Guide

This document outlines the process for configuring all the required environment variables in your Vercel production environment for the Scrpexity application.

## Prerequisites

1. A Vercel account with access to the Scrpexity project
2. All the necessary API keys from your `.env.local` file

## Setting Environment Variables in Vercel

### Method 1: Using the Vercel Dashboard

1. Log in to the [Vercel Dashboard](https://vercel.com/)
2. Select your Scrpexity project
3. Navigate to the "Settings" tab
4. Click on "Environment Variables" in the sidebar
5. Add each environment variable from your `.env.local` file:
   - Enter the name (e.g., `GEMINI_API_KEY`)
   - Enter the value (e.g., `AIzaSyDi2dznV2cTSCNarB7XaOT9gvRdVujD7v0`)
   - Select the environment (Production, Preview, Development)
   - Click "Add"
6. Repeat for all environment variables

### Method 2: Using the Vercel CLI

1. Install the Vercel CLI if you haven't already:
   ```bash
   npm install -g vercel
   ```

2. Authenticate with Vercel:
   ```bash
   vercel login
   ```

3. Pull the current environment variables:
   ```bash
   vercel env pull .env.production
   ```

4. Update the `.env.production` file with all variables from your `.env.local`

5. Push the updated environment variables:
   ```bash
   vercel env push .env.production
   ```

### Method 3: Bulk Import Using a Script

For a large number of environment variables, you can use this script to automate the process:

1. Create a file named `vercel-env-push.js` with the following content:

```javascript
const { execSync } = require('child_process');
const fs = require('fs');

// Read .env.local file
const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = envFile
  .split('\n')
  .filter(line => line.trim() !== '' && !line.startsWith('#'))
  .map(line => {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('='); // Rejoin in case the value contains '='
    return { key: key.trim(), value: value.trim() };
  });

// Push each environment variable to Vercel
envVars.forEach(({ key, value }) => {
  try {
    console.log(`Adding ${key} to Vercel...`);
    execSync(`vercel env add ${key} production`, { 
      input: Buffer.from(value + '\n') 
    });
    console.log(`✓ ${key} added successfully`);
  } catch (error) {
    console.error(`Error adding ${key}: ${error.message}`);
  }
});

console.log('All environment variables have been processed');
```

2. Run the script:
   ```bash
   node vercel-env-push.js
   ```

## Critical Environment Variables

Ensure these essential variables are correctly set for your application to function properly:

### Authentication
- `NEXTAUTH_URL`: Your production URL (e.g., `https://your-app.vercel.app`)
- `NEXTAUTH_SECRET`: Your authentication secret
- `ENCRYPTION_SECRET`: Secret for encrypting sensitive data
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: For Google OAuth

### LLM APIs
- `GEMINI_API_KEY`: For Google Gemini LLM
- `ANTHROPIC_API_KEY`: For Claude models
- All other LLM API keys as applicable

### Search & RAG APIs
- `SCRAPYBARA_API_KEY`: For web scraping functionality
- `EXA_API_KEY`: For search capabilities
- `JINA_API_KEY`: For search capabilities
- `FIRECRAWL_API_KEY`: For advanced web crawling

### Database & Storage
- All Supabase-related configuration (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, etc.)
- Postgres configuration if applicable
- Vector and Redis storage variables

## Vercel-Specific Configuration

Add these Vercel-specific configurations to optimize your deployment:

1. **Edge Function Configuration**:
   - `VERCEL_EDGE_FUNCTION_MEMORY`: Set to `32MB` (minimum) or higher as needed
   - `VERCEL_EDGE_FUNCTION_TIMEOUT`: Set to `30` (seconds) for streaming operations

2. **Build Settings**:
   - Set Build Command: `next build`
   - Set Output Directory: `.next`
   - Node.js Version: Use 18.x or later

## Verifying the Configuration

After setting all environment variables:

1. Trigger a new deployment:
   ```bash
   vercel deploy --prod
   ```

2. Once deployed, verify that authentication works
3. Test the search functionality with a simple query
4. Monitor the Vercel logs for any errors related to missing environment variables

## Troubleshooting

If you encounter issues:

1. Check Vercel logs for any error messages related to missing environment variables
2. Verify that all sensitive values are properly escaped (especially if they contain special characters)
3. Ensure that the environment variables are selected for the correct environments (Production, Preview, Development)
4. For streaming issues, check that the Edge Function settings are configured correctly

## Security Considerations

- Never commit your `.env.local` or `.env.production` files to version control
- Consider using Vercel's encrypted environment variables for sensitive information
- Regularly rotate API keys for security best practices
- Use environment-specific values for different deployment environments

## Next Steps

Once your environment variables are configured:

1. Deploy your application
2. Set up monitoring for API key usage and limits
3. Configure alerts for any authentication or API key failures