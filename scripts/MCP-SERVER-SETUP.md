# MCP Server Setup Guide

This guide explains how to set up and use various Model Context Protocol (MCP) servers for AI agents, including Scrapybara, Playwright, Hyperbrowser, Context7, Operative, Scenario, and Daytona.

## What is MCP?

Model Context Protocol (MCP) is an open protocol that enables AI systems to interact with tools and external systems. MCP servers act as intermediaries that provide specific capabilities to AI agents, such as:

- Web browser automation
- File system access
- Code execution
- Tool integration
- Remote development environments

## Available MCP Servers

The following MCP servers are configured in this project:

1. **Scrapybara** - Virtual Ubuntu environment with browser automation
2. **Playwright** - Browser automation using Microsoft's Playwright
3. **Hyperbrowser** - Advanced browser automation with improved capabilities
4. **Context7** - Context-aware browsing and extraction
5. **Operative** - AI agent testing and monitoring
6. **Scenario** - AI agent simulation and testing
7. **Daytona** - Cloud development environments and remote execution

## Installation

To install all required MCP servers and dependencies:

```bash
node scripts/install-mcp-requirements.js all
```

To install a specific MCP server:

```bash
node scripts/install-mcp-requirements.js scrapybara
```

## Starting MCP Servers

To start all MCP servers:

```bash
node scripts/start-mcp-servers.js all
```

To start a specific MCP server:

```bash
node scripts/start-mcp-servers.js scrapybara
```

## Testing MCP Servers

### Testing Scrapybara MCP

```bash
node scripts/test-scrapybara-mcp.js
```

This script runs a test that:
1. Verifies the Python environment
2. Tests browser automation with Selenium
3. Checks system capabilities

### Testing Daytona MCP

```bash
node scripts/test-daytona-mcp.js
```

This script tests:
1. Remote command execution
2. File and directory operations
3. Environment variable access
4. Workspace information retrieval

## Using MCP Servers with AI Agents

### Scrapybara Example

To use Scrapybara MCP for SQL execution:

```bash
node scripts/scrapybara-execute-sql.js path/to/sql-file.sql
```

See [SCRAPYBARA-SQL-GUIDE.md](./SCRAPYBARA-SQL-GUIDE.md) for more details.

### Daytona Example

Daytona provides cloud development environments and remote execution capabilities. For more information, see [DAYTONA-MCP-GUIDE.md](./DAYTONA-MCP-GUIDE.md).

### Using with Claude or other LLMs

To use these MCP servers with Claude, you need to:

1. Start the desired MCP server
2. Run the Claude CLI or Claude API with the appropriate MCP flags:

```bash
anthropic claude mcp --mcp-server=scrapybara
```

Or programmatically:

```javascript
const { Claude } = require('@anthropic-ai/sdk');
const claude = new Claude({
  apiKey: process.env.ANTHROPIC_API_KEY,
  mcpServers: ['scrapybara'] 
});
```

## MCP Server Configuration

All MCP servers are configured in `mcp-config.json`. You can modify this file to change:

- Command and arguments used to start each server
- Environment variables (including API keys)
- Additional server-specific configurations

## Troubleshooting

### Common Issues

1. **Missing Dependencies**: If you encounter errors about missing packages, run the installation script:
   ```bash
   node scripts/install-mcp-requirements.js <server-name>
   ```

2. **API Key Issues**: Ensure your API keys are correctly set in either:
   - `mcp-config.json`
   - Your environment variables or `.env.local` file

3. **Connection Errors**: Make sure the MCP server is running when you try to use it

4. **Permission Issues**: Some MCP servers may require additional permissions. Check the server logs for details.

## Advanced Usage

### Adding Custom MCP Servers

To add a custom MCP server:

1. Edit `mcp-config.json` and add a new entry:
   ```json
   "custom-server": {
     "command": "npx",
     "args": [
       "custom-package"
     ],
     "env": {
       "CUSTOM_API_KEY": "your-api-key"
     }
   }
   ```

2. Install any required dependencies
3. Start the server using `node scripts/start-mcp-servers.js custom-server`