// MCP Puppeteer Supabase SQL Automation
// This script demonstrates how to use Claude Code's MCP Puppeteer to automate Supabase SQL execution
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

// Get SQL content
const sqlPath = path.join(__dirname, '..', 'migrations', 'output', 'formatted_sql.sql');
if (!fs.existsSync(sqlPath)) {
  console.error(`SQL file not found at ${sqlPath}`);
  process.exit(1);
}

const sqlContent = fs.readFileSync(sqlPath, 'utf8');

// Split SQL into chunks for SQL editor
function splitSqlIntoChunks(sql, maxChunkSize = 10000) {
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
      currentChunk += (currentChunk ? '\n\n' : '') + statementWithSemicolon;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

const sqlChunks = splitSqlIntoChunks(sqlContent, 10000);

// Get the first chunk for demonstration
const firstChunk = sqlChunks[0];
console.log(`First SQL chunk (preview):\n${firstChunk.substring(0, 300)}...\n`);
console.log(`Total SQL chunks: ${sqlChunks.length}`);

// Instructions for using MCP Puppeteer
console.log(`
========================================================
MCP Puppeteer SQL Automation Instructions
========================================================

To execute the SQL in Supabase using MCP Puppeteer:

1. Go to the Supabase dashboard: ${process.env.NEXT_PUBLIC_SUPABASE_URL || 'your-supabase-url'}
2. Log in to your Supabase account
3. Navigate to the SQL Editor
4. For each SQL chunk (total: ${sqlChunks.length}), do the following:
   a. Clear the editor
   b. Paste the SQL chunk
   c. Click "Run" to execute
   d. Wait for execution to complete before proceeding to the next chunk

Below is a step-by-step guide to automate this process using Claude Code's MCP Puppeteer commands:

\`\`\`
# Step 1: Navigate to Supabase
mcp__puppeteer__puppeteer_navigate url=${process.env.NEXT_PUBLIC_SUPABASE_URL || 'your-supabase-url'}

# Step 2: Log in (you'll need to do this part manually)
# After logging in, navigate to the SQL Editor using the sidebar

# Step 3: Take a screenshot to verify you're in the right place
mcp__puppeteer__puppeteer_screenshot name="supabase-sql-editor"

# Step 4: For each SQL chunk, perform these actions:
# 4.1. Clear the editor (look for a Clear button or use keyboard shortcuts)
# 4.2. Fill the editor with SQL:
mcp__puppeteer__puppeteer_evaluate script="document.querySelector('.monaco-editor textarea').value = ''; document.querySelector('.monaco-editor textarea').focus();"
# Then paste the SQL chunk using clipboard or:
mcp__puppeteer__puppeteer_fill selector=".monaco-editor textarea" value="[SQL_CHUNK]"

# 4.3. Click the Run button:
mcp__puppeteer__puppeteer_click selector="button[aria-label='Run query']" # Adjust selector as needed

# 4.4. Wait for execution and verify results:
mcp__puppeteer__puppeteer_screenshot name="sql-execution-result"
\`\`\`

I've saved the SQL chunks to these files for easy access:
`);

// Write individual SQL chunks to files
const chunksDir = path.join(__dirname, '..', 'migrations', 'output', 'chunks');
if (!fs.existsSync(chunksDir)) {
  fs.mkdirSync(chunksDir, { recursive: true });
}

sqlChunks.forEach((chunk, index) => {
  const chunkPath = path.join(chunksDir, `chunk_${index + 1}_of_${sqlChunks.length}.sql`);
  fs.writeFileSync(chunkPath, chunk);
  console.log(`- ${chunkPath}`);
});

console.log(`
You can copy each chunk individually or use the automation guide above.
If you encounter any issues, try executing the SQL statements one by one.

Note: The extension installation SQL should be run first:
- ${path.join(__dirname, '..', 'migrations', 'output', 'install_extensions.sql')}

========================================================
`);