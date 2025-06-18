#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Read the .env.local file
const envFilePath = path.join(process.cwd(), '.env.local');
const envFileContent = fs.readFileSync(envFilePath, 'utf8');

// Parse the env file content to get key-value pairs
const envVars = {};
envFileContent.split('\n').forEach(line => {
  // Skip empty lines and comments
  if (!line || line.startsWith('#')) return;
  
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const [, key, value] = match;
    envVars[key.trim()] = value.trim();
  }
});

// List of environment variables to add to Vercel
const varsToAdd = [
  // LLM API Keys
  { key: 'EXA_API_KEY', sensitive: true },
  { key: 'JINA_API_KEY', sensitive: true },
  { key: 'E2B_API_KEY', sensitive: true },
  { key: 'SCRAPYBARA_API_KEY', sensitive: true },
  
  // Additional LLM API Keys
  { key: 'ANTHROPIC_API_KEY', sensitive: true },
  { key: 'OPENAI_API_KEY', sensitive: true },
  { key: 'OPENROUTER_API_KEY', sensitive: true },
  { key: 'OPENROUTER_FAMILY_KEY', sensitive: true },
  
  // Supabase Configuration
  { key: 'NEXT_PUBLIC_SUPABASE_URL', sensitive: false },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', sensitive: true },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', sensitive: true },
  
  // Authentication
  { key: 'NEXTAUTH_SECRET', sensitive: true },
  { key: 'GOOGLE_CLIENT_ID', sensitive: true },
  { key: 'GOOGLE_CLIENT_SECRET', sensitive: true },
  
  // Add NEXTAUTH_URL with the deployment URL
  { key: 'NEXTAUTH_URL', value: 'https://scrpexity.vercel.app', sensitive: false },
];

// Function to add environment variables to Vercel
async function addEnvToVercel(key, value, options = {}) {
  const { environment = 'production', sensitive = false } = options;
  console.log(`Adding ${key} to Vercel (${environment})...`);
  
  try {
    // Create a temporary file to store the value to avoid shell escaping issues
    const tempFileName = `temp-env-${key}.txt`;
    fs.writeFileSync(tempFileName, value);
    
    // Use the temp file to add the env var and then remove it
    const sensitiveFlag = sensitive ? '--sensitive' : '';
    const command = `vercel env add ${key} ${environment} ${sensitiveFlag} < ${tempFileName}`;
    execSync(command, { stdio: 'inherit' });
    
    // Clean up temp file
    fs.unlinkSync(tempFileName);
    
    console.log(`Successfully added ${key} to ${environment}`);
  } catch (error) {
    console.error(`Error adding ${key}: ${error.message}`);
  }
}

// Main function to add all environment variables
async function setupVercelEnv() {
  console.log('Setting up Vercel environment variables...');
  
  // Add each environment variable to Vercel
  for (const varConfig of varsToAdd) {
    const { key, value: hardcodedValue, sensitive } = varConfig;
    
    // Use hardcoded value if provided, otherwise look in .env.local
    const value = hardcodedValue || envVars[key];
    
    if (value) {
      await addEnvToVercel(key, value, { 
        environment: 'production', 
        sensitive: sensitive 
      });
    } else {
      console.warn(`Warning: ${key} not found in .env.local and no hardcoded value provided`);
    }
  }
  
  console.log('Finished setting up Vercel environment variables');
}

// Execute the main function
setupVercelEnv().catch(error => {
  console.error('Error setting up Vercel environment variables:', error);
  process.exit(1);
});