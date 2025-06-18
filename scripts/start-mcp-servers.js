#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Configuration file path
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

// Function to start a specific MCP server
function startServer(name, serverConfig) {
  if (!serverConfig) {
    console.error(`Server "${name}" not found in configuration`);
    return;
  }

  console.log(`Starting ${name} MCP server...`);
  
  // Create environment variables object
  const env = {
    ...process.env,
    ...(serverConfig.env || {})
  };
  
  // Start the server process
  const server = spawn(serverConfig.command, serverConfig.args, {
    env,
    stdio: 'inherit',
    shell: true
  });
  
  // Handle process events
  server.on('error', (error) => {
    console.error(`Error starting ${name} server:`, error);
  });
  
  server.on('close', (code) => {
    console.log(`${name} server exited with code ${code}`);
  });
  
  console.log(`${name} MCP server started with PID: ${server.pid}`);
  return server;
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
} else if (serverName === 'all') {
  // Start all servers
  Object.entries(mcpServers).forEach(([name, config]) => {
    startServer(name, config);
  });
} else {
  // Start the specified server
  const serverConfig = mcpServers[serverName];
  if (serverConfig) {
    startServer(serverName, serverConfig);
  } else {
    console.error(`Unknown server: ${serverName}`);
    listServers();
    process.exit(1);
  }
}