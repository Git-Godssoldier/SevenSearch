#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Configuration
const DAYTONA_API_KEY = process.env.DAYTONA_API_KEY || 'dtn_0727643505f6d4c6b7ef14eb924a9ab770c0a1d9526d2f38166ee7f3044d30ac';
const DAYTONA_API_URL = process.env.DAYTONA_API_URL || 'https://app.daytona.io/api';
const DAYTONA_ORGANIZATION_ID = process.env.DAYTONA_ORGANIZATION_ID || '2245f69f-8758-4ea4-a647-d2e514cb6c3f';
const DAYTONA_ORGANIZATION_NAME = process.env.DAYTONA_ORGANIZATION_NAME || '38f87a8d-5884-4176-bdc7-8adc001c77cf';

// Create a temporary test Node.js script for Daytona MCP
const mcpScriptPath = path.join(__dirname, 'temp_daytona_mcp_test.js');
const mcpScript = `
async function testDaytona() {
  try {
    console.log('Testing Daytona MCP integration...');
    
    // Test basic commands
    console.log('\\nRunning basic command test:');
    const sysInfo = await daytona.executeCommand('uname -a && hostname && echo "Current date: $(date)"');
    console.log('System info:', sysInfo);
    
    // Test file operations
    console.log('\\nTesting file operations:');
    await daytona.writeFile('test-file.txt', 'This is a test file created by Daytona MCP test.');
    const fileContents = await daytona.readFile('test-file.txt');
    console.log('File contents:', fileContents);
    
    // Test directory operations
    console.log('\\nTesting directory operations:');
    await daytona.createDirectory('test-dir');
    await daytona.writeFile('test-dir/nested-file.txt', 'This is a nested test file.');
    const dirContents = await daytona.listDirectory('.');
    console.log('Directory contents:', dirContents);
    
    // Test environment variables
    console.log('\\nTesting environment variables:');
    const envVars = await daytona.executeCommand('env | grep DAYTONA');
    console.log('Environment variables:', envVars);
    
    // Test workspace information
    console.log('\\nFetching workspace information:');
    const workspaceInfo = await daytona.getWorkspaceInfo();
    console.log('Workspace info:', JSON.stringify(workspaceInfo, null, 2));
    
    // Clean up test files
    console.log('\\nCleaning up test files:');
    await daytona.executeCommand('rm -f test-file.txt && rm -rf test-dir');
    
    return true;
  } catch (error) {
    console.error('Error testing Daytona:', error);
    return false;
  }
}

testDaytona()
  .then(success => {
    if (success) {
      console.log('\\nDaytona MCP test completed successfully');
    } else {
      console.error('\\nDaytona MCP test failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
`;

fs.writeFileSync(mcpScriptPath, mcpScript);

console.log('Starting Daytona MCP test...');

try {
  // Run the test script through the Daytona MCP server
  const env = {
    ...process.env,
    DAYTONA_API_KEY,
    DAYTONA_API_URL,
    DAYTONA_ORGANIZATION_ID,
    DAYTONA_ORGANIZATION_NAME
  };
  
  const command = `npx mastra mcp --mcp-server=daytona node ${mcpScriptPath}`;
  console.log('Executing command:', command);
  
  execSync(command, { 
    encoding: 'utf8',
    env,
    stdio: 'inherit'
  });
  
  console.log('Daytona MCP test completed');
} catch (error) {
  console.error('Error running Daytona MCP test:', error.message);
  process.exit(1);
} finally {
  // Clean up temporary files
  try {
    fs.unlinkSync(mcpScriptPath);
    console.log('Temporary files cleaned up');
  } catch (err) {
    console.error('Error cleaning up temporary files:', err.message);
  }
}