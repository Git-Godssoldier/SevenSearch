#!/usr/bin/env node

const { spawn } = require('child_process');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Create a temporary script to test Playwright MCP
const tempScriptPath = path.join(__dirname, 'temp_playwright_test.js');
const testScript = `
// Simple script to test Playwright MCP
async function testPlaywrightMCP() {
  try {
    console.log('Testing Playwright MCP integration...');
    
    // Navigate to a URL
    console.log('\\nNavigating to a website...');
    const navigateResult = await playwright_navigate({ url: 'https://example.com' });
    console.log('Navigation result:', navigateResult);
    
    // Take a screenshot
    console.log('\\nTaking screenshot...');
    const screenshotResult = await playwright_screenshot({ name: 'example_screenshot' });
    console.log('Screenshot result:', screenshotResult);
    
    // Get page information
    console.log('\\nGetting page content...');
    const pageContent = await playwright_evaluate({ script: 'document.documentElement.outerHTML' });
    console.log('Page content length:', pageContent?.length || 'No content received');
    
    // Click on a link
    console.log('\\nClicking on a link...');
    try {
      await playwright_click({ selector: 'a' });
      console.log('Click successful');
    } catch (error) {
      console.error('Error clicking:', error.message);
    }
    
    // Navigate to another page
    console.log('\\nNavigating to another website...');
    await playwright_navigate({ url: 'https://google.com' });
    console.log('Navigation to Google successful');
    
    // Fill in search box
    console.log('\\nFilling in search...');
    try {
      await playwright_fill({ selector: 'input[name="q"]', value: 'Playwright MCP testing' });
      console.log('Fill successful');
    } catch (error) {
      console.error('Error filling input:', error.message);
    }
    
    return true;
  } catch (error) {
    console.error('Error testing Playwright MCP:', error);
    return false;
  }
}

testPlaywrightMCP()
  .then(success => {
    if (success) {
      console.log('\\nPlaywright MCP test completed successfully');
    } else {
      console.error('\\nPlaywright MCP test failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
`;

// Write the test script to a file
fs.writeFileSync(tempScriptPath, testScript);

// Install Playwright MCP if needed
try {
  console.log('Making sure Playwright MCP is installed...');
  execSync('npm install -g @playwright/mcp@latest', { stdio: 'inherit' });
  console.log('Playwright MCP installed successfully');
} catch (error) {
  console.warn('Warning: Failed to install Playwright MCP globally. Will try to run with npx.', error.message);
}

// Start the Playwright MCP server in a separate process
const playwriteMcpProcess = spawn('npx', ['-y', '@playwright/mcp@latest'], {
  detached: true,
  stdio: 'ignore'
});

// Detach the process so it continues running if this script exits
playwriteMcpProcess.unref();

console.log(`Started Playwright MCP server with PID: ${playwriteMcpProcess.pid}`);

// Give it a moment to start up
console.log('Waiting 5 seconds for the MCP server to start...');
setTimeout(() => {
  // Now run our test script using the MCP server
  try {
    console.log('Running test script against Playwright MCP server...');
    execSync(`npx mastra mcp --mcp-server=playwright node ${tempScriptPath}`, {
      stdio: 'inherit',
      timeout: 60000
    });
    console.log('Test script completed');
  } catch (error) {
    console.error('Error running test script:', error.message);
  } finally {
    // Clean up the temporary script file
    try {
      fs.unlinkSync(tempScriptPath);
      console.log('Cleaned up temporary files');
    } catch (cleanupError) {
      console.warn('Warning: Failed to clean up temporary file:', cleanupError.message);
    }
    
    // Try to kill the MCP server process
    try {
      // On Unix-like systems
      execSync(`pkill -P ${playwriteMcpProcess.pid}`, { stdio: 'ignore' });
      console.log(`Killed Playwright MCP server process with PID: ${playwriteMcpProcess.pid}`);
    } catch (killError) {
      console.warn('Note: The Playwright MCP server may still be running in the background.');
      console.warn('You can manually stop it using Task Manager or `pkill -f "@playwright/mcp"` command.');
    }
  }
}, 5000);