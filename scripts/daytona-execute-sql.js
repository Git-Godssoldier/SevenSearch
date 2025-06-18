#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Configuration
const DAYTONA_API_KEY = process.env.DAYTONA_API_KEY || 'dtn_0727643505f6d4c6b7ef14eb924a9ab770c0a1d9526d2f38166ee7f3044d30ac';
const DAYTONA_API_URL = process.env.DAYTONA_API_URL || 'https://app.daytona.io/api';
const DAYTONA_ORGANIZATION_ID = process.env.DAYTONA_ORGANIZATION_ID || '2245f69f-8758-4ea4-a647-d2e514cb6c3f';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Ensure required environment variables are set
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables. Please check .env.local file.');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Get SQL file from command line argument or use default
const sqlFilePath = process.argv[2] || path.resolve(__dirname, '../migrations/setup_combined.sql');
if (!fs.existsSync(sqlFilePath)) {
  console.error(`SQL file not found: ${sqlFilePath}`);
  process.exit(1);
}

// Read SQL content
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

// Split SQL into manageable chunks if it's large
function splitSqlIntoChunks(sql, maxChunkSize = 15000) {
  const statements = sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);
  
  const chunks = [];
  let currentChunk = '';
  
  for (const statement of statements) {
    if (currentChunk.length + statement.length + 1 > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk + ';');
      currentChunk = '';
    }
    currentChunk += (currentChunk.length > 0 ? '\n' : '') + statement + ';';
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

const SQL_CHUNKS = splitSqlIntoChunks(sqlContent);

// Create a temporary Node.js script for Daytona
const tempScriptPath = path.join(__dirname, 'temp_daytona_sql.js');
const daytonaScript = `
async function executeSqlWithDaytona() {
  try {
    console.log('Setting up Daytona environment for SQL execution...');
    
    // Create a temporary directory for SQL files
    await daytona.executeCommand('mkdir -p ~/sql_execution');
    
    // Set up environment variables
    const supabaseUrl = "${SUPABASE_URL}";
    const supabaseKey = "${SUPABASE_SERVICE_ROLE_KEY}";
    
    // Install required tools if not already available
    console.log('Checking for curl and jq...');
    try {
      await daytona.executeCommand('which curl jq');
    } catch (error) {
      console.log('Installing required tools...');
      await daytona.executeCommand('apt-get update && apt-get install -y curl jq');
    }
    
    // Write SQL chunks to files
    const sqlChunks = ${JSON.stringify(SQL_CHUNKS)};
    console.log(\`Preparing \${sqlChunks.length} SQL chunks for execution...\`);
    
    for (let i = 0; i < sqlChunks.length; i++) {
      const chunkPath = \`~/sql_execution/chunk_\${i+1}.sql\`;
      await daytona.writeFile(chunkPath, sqlChunks[i]);
    }
    
    // Execute each SQL chunk
    for (let i = 0; i < sqlChunks.length; i++) {
      console.log(\`Executing SQL chunk \${i+1} of \${sqlChunks.length}...\`);
      const chunkPath = \`~/sql_execution/chunk_\${i+1}.sql\`;
      
      // Read SQL content
      const sql = await daytona.readFile(chunkPath);
      
      // Create a script to execute the SQL
      const scriptPath = '~/sql_execution/execute.sh';
      const scriptContent = \`#!/bin/bash
curl -X POST "\${supabaseUrl}/rest/v1/rpc/exec_sql" \\
  -H "apikey: \${supabaseKey}" \\
  -H "Authorization: Bearer \${supabaseKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"sql": \${JSON.stringify(sql)}}'
\`;
      
      await daytona.writeFile(scriptPath, scriptContent);
      await daytona.executeCommand('chmod +x ~/sql_execution/execute.sh');
      
      // Execute the script
      const result = await daytona.executeCommand('~/sql_execution/execute.sh');
      console.log(\`Execution result for chunk \${i+1}: \${result || 'Success'}\`);
    }
    
    console.log('All SQL chunks executed successfully');
    
    // Clean up
    await daytona.executeCommand('rm -rf ~/sql_execution');
    
    return true;
  } catch (error) {
    console.error('Error executing SQL with Daytona:', error);
    return false;
  }
}

executeSqlWithDaytona()
  .then(success => {
    if (success) {
      console.log('SQL execution completed successfully');
    } else {
      console.error('SQL execution failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
`;

// Write the script to a temporary file
fs.writeFileSync(tempScriptPath, daytonaScript);

// Function to execute the script with Daytona
async function executeWithDaytona() {
  try {
    console.log('Initializing Daytona MCP server...');
    
    // Run the Node.js script through the Daytona MCP server
    const env = {
      ...process.env,
      DAYTONA_API_KEY,
      DAYTONA_API_URL,
      DAYTONA_ORGANIZATION_ID
    };
    
    const command = `npx mastra mcp --mcp-server=daytona node ${tempScriptPath}`;
    console.log('Executing command:', command);
    
    execSync(command, { 
      encoding: 'utf8',
      env,
      stdio: 'inherit'
    });
    
    console.log('SQL execution with Daytona completed');
    
    // Clean up temporary file
    fs.unlinkSync(tempScriptPath);
    
    return true;
  } catch (error) {
    console.error('Error executing SQL with Daytona:', error);
    return false;
  }
}

// Run the script
executeWithDaytona()
  .then(success => {
    if (success) {
      console.log('SQL setup completed successfully');
    } else {
      console.error('SQL setup failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });