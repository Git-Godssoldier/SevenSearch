#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Define the path to the configuration file
const CONFIG_PATH = path.join(__dirname, 'mcp-config.json');

// Check if configuration file exists
if (!fs.existsSync(CONFIG_PATH)) {
  console.error(`MCP configuration file not found: ${CONFIG_PATH}`);
  process.exit(1);
}

// Read configuration
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const { mcpServers } = config;

// Get command-line arguments
const args = process.argv.slice(2);
const serverName = args[0];

// Function to install dependencies for a specific MCP server
function installServerDependencies(name, serverConfig) {
  if (!serverConfig) {
    console.error(`Server "${name}" not found in configuration`);
    return;
  }

  console.log(`Installing dependencies for ${name} MCP server...`);
  
  let packageName;
  
  // Determine package to install based on server configuration
  if (serverConfig.args && serverConfig.args.length > 0) {
    // Extract package name from args
    packageName = serverConfig.args.filter(arg => arg.startsWith('@') || !arg.startsWith('-'))[0];
  }
  
  if (!packageName) {
    console.error(`Could not determine package name for ${name}`);
    return;
  }
  
  try {
    // Install the package
    console.log(`Installing ${packageName}...`);
    execSync(`npm install -g ${packageName}`, { stdio: 'inherit' });
    console.log(`Successfully installed ${packageName}`);
    
    // Check if there are additional dependencies to install
    if (name === 'scrapybara') {
      console.log('Installing additional dependencies for Scrapybara...');
      execSync('npm install -g @mastra/cli', { stdio: 'inherit' });
    }
    
    console.log(`All dependencies for ${name} installed successfully.`);
  } catch (error) {
    console.error(`Error installing dependencies for ${name}:`, error.message);
  }
}

// Function to list available servers
function listServers() {
  console.log('Available MCP servers:');
  Object.keys(mcpServers).forEach(name => {
    console.log(`  - ${name}`);
  });
}

// Main execution
if (!serverName || serverName === 'list') {
  listServers();
  console.log('\nUsage: node install-mcp-requirements.js <server-name|all>');
} else if (serverName === 'all') {
  // Install dependencies for all servers
  Object.entries(mcpServers).forEach(([name, config]) => {
    installServerDependencies(name, config);
  });
} else {
  // Install dependencies for the specified server
  const serverConfig = mcpServers[serverName];
  if (serverConfig) {
    installServerDependencies(serverName, serverConfig);
  } else {
    console.error(`Unknown server: ${serverName}`);
    listServers();
    process.exit(1);
  }
}