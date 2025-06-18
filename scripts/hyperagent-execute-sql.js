// HyperAgent SQL Automation Script
// This script uses HyperAgent to automate SQL execution in Supabase

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Make sure necessary environment variables are set
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!SUPABASE_URL) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL is not defined in your .env.local file');
  process.exit(1);
}

// Get HyperBrowser API key from .env.local or all-keys.md
const HYPERBROWSER_API_KEY = process.env.HYPERBROWSER_API_KEY;
if (!HYPERBROWSER_API_KEY) {
  console.log('Warning: HYPERBROWSER_API_KEY not found in .env.local, checking all-keys.md...');
  
  // Try to extract key from all-keys.md
  try {
    const keysPath = path.join(__dirname, '..', 'all-keys.md');
    if (fs.existsSync(keysPath)) {
      const keysContent = fs.readFileSync(keysPath, 'utf8');
      const match = keysContent.match(/HYPERBROWSER_API_KEY=([^\s]+)/);
      if (match && match[1]) {
        process.env.HYPERBROWSER_API_KEY = match[1];
        console.log(`Found HYPERBROWSER_API_KEY: ${match[1].substring(0, 5)}...`);
      }
    }
  } catch (error) {
    console.log('Could not extract HYPERBROWSER_API_KEY from all-keys.md');
  }
}

// Read SQL file
const sqlPath = path.join(__dirname, '..', 'migrations', 'output', 'formatted_sql.sql');
if (!fs.existsSync(sqlPath)) {
  console.error(`SQL file not found at ${sqlPath}`);
  process.exit(1);
}

const sqlContent = fs.readFileSync(sqlPath, 'utf8');

// Create HyperAgent script
const hyperAgentScriptPath = path.join(__dirname, 'exec-supabase-sql.js');
const hyperAgentScript = `
// Automated SQL Execution with HyperAgent
// This script uses HyperAgent to automate executing SQL in Supabase
const { HyperAgent } = require('@hyperbrowser/agent');

async function executeSqlWithHyperAgent() {
  console.log('Starting SQL execution automation with HyperAgent...');
  
  // Initialize HyperAgent
  const agent = new HyperAgent({
    browserProvider: process.env.HYPERBROWSER_API_KEY ? 'hyperbrowser' : 'local',
  });

  try {
    console.log('Creating new browser page...');
    const page = await agent.newPage();
    
    // 1. Navigate to Supabase
    console.log('Navigating to Supabase...');
    await page.goto('${SUPABASE_URL}');
    
    // 2. Guide user to log in and navigate to SQL Editor
    console.log('\\n⚠️ IMPORTANT INSTRUCTIONS ⚠️');
    console.log('1. Please log in to Supabase when the browser opens');
    console.log('2. Once logged in, navigate to the SQL Editor');
    console.log('3. Once you are in the SQL Editor, press Enter in this terminal to continue');
    
    // Wait for user input
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
      console.log('Press Enter once you are in the SQL Editor...');
    });
    
    // 3. Execute SQL statements using AI
    console.log('\\nExecuting SQL statements...');
    
    // First, execute the extension installation SQL
    const extensionsSQL = \`
-- This SQL script installs the extensions required for the database tables

-- Install uuid-ossp extension (needed for uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Check if extensions were installed successfully
SELECT 
  extname AS extension_name,
  extversion AS version,
  'Extension is installed and ready' AS status
FROM pg_extension 
WHERE extname = 'uuid-ossp';
    \`;
    
    // Use page.ai to execute extensions SQL
    console.log('Installing required extensions...');
    await page.ai(\`
Clear the SQL Editor, then paste and execute the following SQL:
\${extensionsSQL}
Wait for the SQL to finish executing before continuing.
    \`);
    
    // Then execute the main SQL
    console.log('\\nNow executing the main SQL statements...');
    
    // Split SQL into smaller chunks for better execution
    const sqlChunks = splitSqlIntoChunks(\`${sqlContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`);
    
    for (let i = 0; i < sqlChunks.length; i++) {
      console.log(\`Executing SQL chunk \${i + 1} of \${sqlChunks.length}...\`);
      
      // Use page.ai to execute this SQL chunk
      await page.ai(\`
Clear the SQL Editor, then paste and execute the following SQL:
\${sqlChunks[i]}
Wait for the SQL to finish executing before continuing.
      \`);
      
      console.log(\`Chunk \${i + 1} executed. Pausing before next chunk...\`);
      
      // Small delay between chunks to ensure proper execution
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('\\n🎉 SQL execution completed!');
    
    // Verify tables were created
    console.log('\\nVerifying table creation...');
    await page.ai(\`
Clear the SQL Editor, then paste and execute the following SQL:
SELECT table_name, to_char(create_time, 'YYYY-MM-DD HH24:MI:SS') as created_at
FROM (
  SELECT tablename as table_name, max(create_time) as create_time
  FROM pg_tables left join pg_stat_user_tables on tablename = relname
  WHERE schemaname = 'public'
  GROUP BY tablename
) t
ORDER BY created_at DESC;
Wait for the results to appear and tell me which tables were successfully created.
    \`);
    
    // Keep browser open for manual inspection
    console.log('\\nBrowser will remain open for you to verify the results.');
    console.log('Press Enter to close the browser and exit.');
    
    // Wait for user input to close
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
  } catch (error) {
    console.error('An error occurred during SQL execution:', error);
  } finally {
    // Clean up
    await agent.closeAgent();
    console.log('Browser closed.');
  }
}

// Function to split SQL into manageable chunks
function splitSqlIntoChunks(sql, maxChunkSize = 8000) {
  // Split by semicolon to get individual statements
  const statements = sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);
  
  const chunks = [];
  let currentChunk = '';
  
  for (const statement of statements) {
    const statementWithSemicolon = statement + ';';
    
    if (currentChunk.length + statementWithSemicolon.length > maxChunkSize) {
      chunks.push(currentChunk);
      currentChunk = statementWithSemicolon;
    } else {
      currentChunk += (currentChunk ? '\\n\\n' : '') + statementWithSemicolon;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// Run the main function
executeSqlWithHyperAgent().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
`;

// Write the script to file
fs.writeFileSync(hyperAgentScriptPath, hyperAgentScript);
console.log(`Generated HyperAgent script at: ${hyperAgentScriptPath}`);

// Create installation script
const installScriptPath = path.join(__dirname, 'install-hyperagent.sh');
const installScript = `#!/bin/bash
# Install HyperAgent for Supabase SQL automation
npm install @hyperbrowser/agent langchain @langchain/openai zod dotenv --no-save

# Export environment variables
export HYPERBROWSER_API_KEY="hb_89ecf89b95704397b7124e324cd0"
export OPENAI_API_KEY="${process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY'}"

# Run the automation script
node ./exec-supabase-sql.js
`;

fs.writeFileSync(installScriptPath, installScript);
fs.chmodSync(installScriptPath, '755'); // Make executable
console.log(`Generated installation script at: ${installScriptPath}`);

// Output instructions
console.log(`
=================================================
Supabase SQL Execution using HyperAgent
=================================================

This automation will:
1. Open a browser session using HyperAgent/HyperBrowser
2. Navigate to your Supabase instance at ${SUPABASE_URL}
3. Wait for you to log in and navigate to the SQL Editor
4. Execute the SQL required for database setup
5. Verify the created tables

To run the automation:

1. First make sure your .env.local has these keys:
   - HYPERBROWSER_API_KEY (optional, will use local browser if not provided)
   - OPENAI_API_KEY (required for HyperAgent AI capabilities)

2. Run the installation script which will set up the required packages:
   $ cd ${path.relative(process.cwd(), __dirname)}
   $ ./install-hyperagent.sh

3. Follow the prompts in the terminal during execution

Note: The browser window will open and you'll need to:
- Log in to your Supabase account
- Navigate to the SQL Editor
- Then press Enter in the terminal to continue

=================================================
`);

// Optionally, check for required API keys
if (!process.env.HYPERBROWSER_API_KEY) {
  console.log('\n⚠️ Warning: HYPERBROWSER_API_KEY not found. The script will use a local browser.');
  console.log('For better results, add your HyperBrowser API key to .env.local.');
}

if (!process.env.OPENAI_API_KEY) {
  console.log('\n⚠️ Warning: OPENAI_API_KEY not found. This is required for HyperAgent.');
  console.log('Add your OpenAI API key to .env.local before running the script.');
}