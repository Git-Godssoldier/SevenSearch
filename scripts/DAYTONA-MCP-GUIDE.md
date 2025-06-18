# Daytona MCP Integration Guide

This guide explains how to use Daytona with the Model Context Protocol (MCP) for cloud development environments and remote execution capabilities.

## What is Daytona?

[Daytona](https://www.daytona.io/) is a platform for creating and managing cloud development environments. Daytona MCP allows AI agents to interact with Daytona workspaces through the Model Context Protocol, providing:

- Remote file operations
- Command execution
- Workspace management 
- Environment access

## Prerequisites

- Daytona account with appropriate permissions
- Daytona API key
- Organization ID
- API URL

## Setup

1. Ensure your `.env.local` file contains the following variables:
   ```
   DAYTONA_API_KEY=your-daytona-api-key
   DAYTONA_API_URL=https://app.daytona.io/api
   DAYTONA_ORGANIZATION_ID=your-organization-id
   DAYTONA_ORGANIZATION_NAME=your-organization-name
   ```

2. Install the required dependencies:
   ```bash
   npm install -g @mastra/cli
   npm install -g @daytona/mcp
   ```

## Starting the Daytona MCP Server

Use the `start-mcp-servers.js` script to start the Daytona MCP server:

```bash
node scripts/start-mcp-servers.js daytona
```

## Testing Daytona MCP

The `test-daytona-mcp.js` script validates your Daytona MCP integration by:

1. Running basic commands
2. Testing file operations
3. Verifying directory operations
4. Checking environment variables
5. Retrieving workspace information

To run the test:

```bash
node scripts/test-daytona-mcp.js
```

## Using Daytona MCP for SQL Execution

You can leverage Daytona for executing SQL in remote development environments:

```javascript
// Example: Execute SQL in Daytona environment
async function executeSqlWithDaytona(sqlFilePath) {
  // Read SQL file
  const sql = fs.readFileSync(sqlFilePath, 'utf8');
  
  // Upload SQL file to Daytona workspace
  await daytona.writeFile('script.sql', sql);
  
  // Execute SQL using psql or appropriate tool
  const result = await daytona.executeCommand('psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f script.sql');
  
  return result;
}
```

## Available Daytona MCP Functions

Daytona MCP provides the following capabilities:

### File Operations
- `readFile(path)` - Read a file from the workspace
- `writeFile(path, content)` - Write content to a file
- `deleteFile(path)` - Delete a file
- `fileExists(path)` - Check if a file exists

### Directory Operations
- `createDirectory(path)` - Create a directory
- `listDirectory(path)` - List directory contents
- `deleteDirectory(path)` - Delete a directory

### Command Execution
- `executeCommand(command)` - Execute a shell command in the workspace

### Workspace Management
- `getWorkspaceInfo()` - Get information about the current workspace
- `listWorkspaces()` - List available workspaces
- `switchWorkspace(id)` - Switch to a different workspace

## Example Workflow: Database Migration in Daytona

Here's how to use Daytona MCP for performing database migrations:

1. Upload migration files to the workspace:
   ```javascript
   await daytona.createDirectory('migrations');
   await daytona.writeFile('migrations/01_create_table.sql', '-- SQL content here');
   ```

2. Install any required tools:
   ```javascript
   await daytona.executeCommand('npm install -g db-migrate');
   ```

3. Run migrations:
   ```javascript
   const result = await daytona.executeCommand('cd migrations && db-migrate up');
   ```

4. Verify results:
   ```javascript
   const tableCheck = await daytona.executeCommand('psql -c "\\dt"');
   console.log('Tables created:', tableCheck);
   ```

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify your API key is correct
   - Ensure your organization ID is valid
   - Check that your API URL is correct

2. **Workspace Access Issues**
   - Confirm you have the appropriate permissions
   - Verify the workspace exists and is accessible
   - Check if the workspace is currently active

3. **Command Execution Failures**
   - Ensure the commands are compatible with the workspace environment
   - Check if required tools are installed
   - Verify environment variables are set correctly

### Debug Mode

Enable debug mode for more detailed logs:

```bash
DEBUG=daytona:* node scripts/test-daytona-mcp.js
```

## Integration with Other MCP Servers

Daytona MCP can be used alongside other MCP servers like Scrapybara, Playwright, and Hyperbrowser for a comprehensive AI agent toolkit. See [MCP-SERVER-SETUP.md](./MCP-SERVER-SETUP.md) for details on configuring multiple MCP servers.