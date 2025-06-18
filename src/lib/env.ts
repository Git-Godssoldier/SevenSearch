/**
 * Environment variable configuration
 */

// Default values to use when environment variables are not set
// These allow the build to succeed even when environment variables are missing
const defaults = {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'example-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'example-service-role-key',
  
  // API Keys
  EXA_API_KEY: 'example-exa-key',
  JINA_API_KEY: 'example-jina-key',
  FIRECRAWL_API_KEY: 'example-firecrawl-key',
  GEMINI_API_KEY: 'example-gemini-key',
  SCRAPYBARA_API_KEY: 'example-scrapybara-key',
  
  // E2B
  E2B_API_KEY: 'example-e2b-key',
  
  // Authentication
  NEXTAUTH_SECRET: 'example-nextauth-secret',
  NEXTAUTH_URL: 'http://localhost:3000',
};

/**
 * Get environment variable with fallback to default if not available
 */
function getEnvVar(key: string): string {
  const value = process.env[key] || defaults[key as keyof typeof defaults];
  
  if (!value) {
    console.warn(`Environment variable ${key} is not set`);
  }
  
  return value || '';
}

/**
 * Environment variables accessible throughout the application
 */
export const env = {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
  
  // API Keys
  EXA_API_KEY: getEnvVar('EXA_API_KEY'),
  JINA_API_KEY: getEnvVar('JINA_API_KEY'),
  FIRECRAWL_API_KEY: getEnvVar('FIRECRAWL_API_KEY'),
  GEMINI_API_KEY: getEnvVar('GEMINI_API_KEY'),
  SCRAPYBARA_API_KEY: getEnvVar('SCRAPYBARA_API_KEY'),
  
  // E2B
  E2B_API_KEY: getEnvVar('E2B_API_KEY'),
  
  // Authentication
  NEXTAUTH_SECRET: getEnvVar('NEXTAUTH_SECRET'),
  NEXTAUTH_URL: getEnvVar('NEXTAUTH_URL'),
  
  // App configuration
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
};