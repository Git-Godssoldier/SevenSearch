// HyperAgent Supabase SQL Automation
// This script uses HyperAgent to automate creating tables in the Supabase SQL Editor
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

// Import required modules - Note: These need to be installed
// npm install puppeteer @hyperbrowser/agent

async function main() {
  try {
    // Since we can't install HyperAgent directly due to dependency issues,
    // we'll generate a Puppeteer script that can be run separately
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      console.error('Error: NEXT_PUBLIC_SUPABASE_URL is not defined in your .env.local file');
      process.exit(1);
    }
    
    // Create the Puppeteer script
    const scriptPath = path.join(__dirname, 'supabase-sql-automation.js');
    
    // Get the SQL content
    const sqlPath = path.join(__dirname, '..', 'migrations', 'output', 'formatted_sql.sql');
    if (!fs.existsSync(sqlPath)) {
      console.error(`SQL file not found at ${sqlPath}`);
      process.exit(1);
    }
    
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split SQL into chunks for SQL editor
    const sqlChunks = splitSqlIntoChunks(sqlContent, 10000);
    
    // Create script content
    const scriptContent = `
// This script automates the execution of SQL in Supabase SQL Editor using Puppeteer
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration
const SUPABASE_URL = '${supabaseUrl}';
const SQL_CHUNKS = ${JSON.stringify(sqlChunks, null, 2)};

async function runSql() {
  console.log('Starting Supabase SQL automation with Puppeteer');
  
  // Launch a new browser instance
  const browser = await puppeteer.launch({
    headless: false, // Set to true for headless operation
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to Supabase
    console.log('Navigating to Supabase...');
    await page.goto(SUPABASE_URL);
    
    // Wait for user to log in manually
    console.log('⚠️ Please log in to Supabase manually when the browser opens');
    
    // Wait for dashboard to load after login
    await page.waitForSelector('.supabase-dashboard', { timeout: 300000 });
    console.log('Dashboard loaded. Navigating to SQL Editor...');
    
    // Navigate to SQL Editor
    await page.evaluate(() => {
      // Look for SQL Editor in the sidebar
      const sidebarItems = Array.from(document.querySelectorAll('a, button'));
      const sqlEditorLink = sidebarItems.find(item => 
        item.textContent.toLowerCase().includes('sql') || 
        item.textContent.toLowerCase().includes('editor')
      );
      
      if (sqlEditorLink) sqlEditorLink.click();
    });
    
    // Wait for SQL Editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 60000 });
    console.log('SQL Editor loaded.');
    
    // Execute each SQL chunk
    for (let i = 0; i < SQL_CHUNKS.length; i++) {
      console.log(\`Executing SQL chunk \${i + 1} of \${SQL_CHUNKS.length}...\`);
      
      // Clear existing SQL and insert new chunk
      await page.evaluate(() => {
        // Find the Monaco editor instance
        const editor = document.querySelector('.monaco-editor');
        if (editor) {
          // Clear editor using browser APIs
          const clearButton = Array.from(document.querySelectorAll('button'))
            .find(btn => btn.textContent.toLowerCase().includes('clear'));
          
          if (clearButton) clearButton.click();
        }
      });
      
      // Type the SQL
      await page.type('.monaco-editor textarea', SQL_CHUNKS[i]);
      
      // Click the Run button
      await page.evaluate(() => {
        const runButton = Array.from(document.querySelectorAll('button'))
          .find(btn => 
            btn.textContent.toLowerCase().includes('run') || 
            btn.getAttribute('aria-label')?.toLowerCase().includes('run')
          );
        
        if (runButton) runButton.click();
      });
      
      // Wait for execution to complete
      console.log('Waiting for SQL execution to complete...');
      await page.waitForTimeout(5000); // Basic wait time
      
      // Check for error messages
      const hasError = await page.evaluate(() => {
        return !!document.querySelector('.error-message') || 
               !!document.querySelector('[data-test="error-message"]');
      });
      
      if (hasError) {
        console.log('⚠️ Warning: Possible error detected in SQL execution');
        // Continue anyway
      } else {
        console.log('SQL chunk executed successfully');
      }
      
      // Wait a moment before next statement
      await page.waitForTimeout(2000);
    }
    
    console.log('All SQL chunks executed! 🎉');
    
    // Keep the browser open for manual inspection
    console.log('Browser will remain open for you to verify the results.');
    console.log('Close the browser manually when finished.');
    
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

// Run the automation
runSql();
`;
    
    // Write the script to file
    fs.writeFileSync(scriptPath, scriptContent);
    console.log(`Generated Puppeteer automation script at: ${scriptPath}`);
    
    // Create a separate installation script
    const installPath = path.join(__dirname, 'install-puppeteer.sh');
    const installContent = `#!/bin/bash
# Install Puppeteer for Supabase SQL automation
npm install puppeteer --no-save

# Run the automation script
node ./supabase-sql-automation.js
`;
    
    fs.writeFileSync(installPath, installContent);
    fs.chmodSync(installPath, '755'); // Make executable
    console.log(`Generated installation script at: ${installPath}`);
    
    console.log('\nInstructions:');
    console.log('1. Run the installation script: ./install-puppeteer.sh');
    console.log('2. This will install Puppeteer and launch the automation');
    console.log('3. A browser will open. Log in to Supabase when prompted');
    console.log('4. The script will automatically navigate to SQL Editor and execute your SQL');
    console.log('5. The browser will remain open for you to verify the results');
    
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

// Function to split SQL into multiple parts if it's too large
function splitSqlIntoChunks(sql, maxChunkSize = 15000) {
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

// Run the main function
main();