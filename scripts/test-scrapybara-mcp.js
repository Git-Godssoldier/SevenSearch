#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Configuration
const SCRAPYBARA_API_KEY = process.env.SCRAPYBARA_API_KEY || 'scrapy-fb16c7eb-2450-4d6e-89b3-9ec0a0931295';

// Create a temporary test script
const testScriptPath = path.join(__dirname, 'temp_scrapybara_test.py');
const pythonScript = `
import sys
import platform
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

print("Python version:", sys.version)
print("Platform:", platform.platform())

# Initialize Chrome browser
options = Options()
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--headless=new")

try:
    # Create a browser instance
    print("Initializing Chrome browser...")
    browser = webdriver.Chrome(options=options)
    
    # Navigate to a test page
    print("Navigating to example.com...")
    browser.get("https://example.com")
    
    # Get page title
    title = browser.title
    print(f"Page title: {title}")
    
    # Get page content
    content = browser.page_source[:500]  # First 500 chars
    print(f"Page content snippet: {content[:100]}...")
    
    # Take screenshot
    print("Taking screenshot...")
    browser.save_screenshot("example_screenshot.png")
    print("Screenshot saved")
    
    # Close browser
    browser.quit()
    print("Test completed successfully")
    
except Exception as e:
    print(f"Error during test: {str(e)}")
    import traceback
    traceback.print_exc()
`;

// Write the Python script to a temporary file
fs.writeFileSync(testScriptPath, pythonScript);

// Create a temporary Node.js script for Scrapybara MCP
const mcpScriptPath = path.join(__dirname, 'temp_scrapybara_mcp_test.js');
const mcpScript = `
async function testScrapybara() {
  try {
    console.log('Testing Scrapybara MCP server...');
    
    // Test Python environment
    console.log('\\nRunning Python environment check:');
    const envResult = await scrapybara.executeCommand({
      command: 'python3 --version && which python3'
    });
    console.log('Python environment:', envResult);
    
    // Execute the test script
    console.log('\\nRunning Selenium test script:');
    const result = await scrapybara.executeScript({
      pythonScript: ${JSON.stringify(testScriptPath)},
      timeout: 60000
    });
    
    console.log('Test script output:', result);
    
    // Test system capabilities
    console.log('\\nChecking system capabilities:');
    const sysInfo = await scrapybara.executeCommand({
      command: 'uname -a && free -h && df -h'
    });
    console.log('System info:', sysInfo);
    
    return true;
  } catch (error) {
    console.error('Error testing Scrapybara:', error);
    return false;
  }
}

testScrapybara()
  .then(success => {
    if (success) {
      console.log('\\nScrapybara MCP test completed successfully');
    } else {
      console.error('\\nScrapybara MCP test failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
`;

fs.writeFileSync(mcpScriptPath, mcpScript);

console.log('Starting Scrapybara MCP test...');

try {
  // Run the test script through the MCP server
  const command = `SCRAPYBARA_API_KEY=${SCRAPYBARA_API_KEY} npx mastra mcp --mcp-server=scrapybara node ${mcpScriptPath}`;
  console.log('Executing command:', command);
  
  execSync(command, { 
    encoding: 'utf8',
    env: {
      ...process.env,
      SCRAPYBARA_API_KEY
    },
    stdio: 'inherit'
  });
  
  console.log('Scrapybara MCP test completed');
} catch (error) {
  console.error('Error running Scrapybara MCP test:', error.message);
  process.exit(1);
} finally {
  // Clean up temporary files
  try {
    fs.unlinkSync(testScriptPath);
    fs.unlinkSync(mcpScriptPath);
    console.log('Temporary files cleaned up');
  } catch (err) {
    console.error('Error cleaning up temporary files:', err.message);
  }
}