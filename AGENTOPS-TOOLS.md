# Agent Testing and Automation Tools

This document provides an overview of key tools for testing and automating AI agents.

## Operative.sh

[Operative.sh](https://operative.sh/) is a powerful platform for building production-ready AI agents.

### Key Features

- **Agent Framework**: Simplifies building autonomous AI agents
- **Monitoring**: Comprehensive agent monitoring and observability
- **Production-Ready**: Scales to handle high-throughput agent deployments
- **API Integration**: Connects with various APIs and data sources

### Getting Started

```bash
# Install the Operative client
npm install @operative/client

# Initialize Operative in your project
npx operative init

# Get your API key from the dashboard
export OPERATIVE_API_KEY="op-KLoKiSTKVXUciE6OhbDTn5Q8iCyjuiTqN1lBkJL0AFY"
```

### Example Operative.sh Agent

```javascript
import { operative } from '@operative/client';

// Initialize with your API key
const agent = operative({
  apiKey: process.env.OPERATIVE_API_KEY
});

// Create a task
const task = await agent.createTask({
  name: 'Database Setup Task',
  description: 'Set up database tables in Supabase',
  inputs: {
    sqlFile: './migrations/combined_tables.sql'
  }
});

// Execute and monitor the task
const execution = await task.execute();
console.log(`Task status: ${execution.status}`);
```

## Scenario.gg

[Scenario.gg](https://scenario.gg/) is a specialized platform for testing AI agents in simulated environments.

### Key Features

- **Simulated Environments**: Create controlled test scenarios
- **Agent Evaluation**: Assess agent performance in different scenarios
- **Benchmark Suite**: Pre-built scenarios for comparative testing
- **Regression Testing**: Catch issues before production deployment

### Example Use Case

```javascript
// Example of using Scenario.gg to test a database setup agent
const scenario = new Scenario({
  name: 'Database Setup Test',
  environment: {
    type: 'supabase',
    credentials: {
      url: process.env.SUPABASE_URL,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  }
});

// Define success criteria
scenario.addSuccessCriteria({
  tableMustExist: ['users', 'searches', 'tasks'],
  extensionMustBeEnabled: ['uuid-ossp']
});

// Run the agent in the scenario
const result = await scenario.runAgent(databaseSetupAgent);
console.log(`Agent passed scenario: ${result.success}`);
```

## AgentOps

[AgentOps](https://agentops.ai/) is a monitoring and observability platform specifically designed for AI agents.

### Key Features

- **Agent Telemetry**: Collect detailed performance metrics
- **Tracing**: Trace agent execution paths
- **Cost Tracking**: Monitor and optimize token usage and costs
- **Integration**: Works with most agent frameworks (Langchain, CrewAI, etc.)

### Getting Started

```bash
# Install AgentOps SDK
pip install agentops

# Initialize in your code
import agentops

# Track agent runs
agentops.init(api_key="eef8680e-7d37-4b39-b2f0-7ecc0d49311c")
agent_run = agentops.start_run(run_id="db-setup-run-001")

# Log agent steps
agent_run.log(
  action="execute_sql", 
  input="CREATE TABLE users...",
  output="Table created successfully"
)

# Complete the run
agent_run.end(status="success")
```

## Browser MCPs (Model Context Protocol Servers)

Browser MCPs enable AI models like Claude to interact with web browsers.

### Microsoft Playwright MCP

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

### ExecuteAutomation Playwright MCP

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@executeautomation/playwright-mcp-server"]
    }
  }
}
```

### Hyperbrowser MCP

```json
{
  "mcpServers": {
    "hyperbrowser": {
      "command": "npx",
      "args": ["-y", "@hyperbrowser/mcp-server"],
      "env": {
        "HYPERBROWSER_API_KEY": "hb_89ecf89b95704397b7124e324cd0"
      }
    }
  }
}
```

## Context7 MCP

[Context7](https://context7.com/) is an MCP that provides up-to-date documentation to AI models.

### Features

- **Fresh Documentation**: Real-time, up-to-date library documentation
- **Code Examples**: Current code snippets from libraries
- **Token Limiting**: Smart token usage management
- **RAG-style Context**: Retrieval augmented generation

### Setup

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    }
  }
}
```

## Integration Strategy

For a comprehensive agent testing and automation setup:

1. Use **Browser MCPs** for web UI automation tasks
2. Implement **Operative.sh** for building and orchestrating agents
3. Set up **Scenario.gg** for controlled testing environments
4. Add **AgentOps** for monitoring and observability
5. Use **Context7** to ensure agents have access to current documentation

This multi-layered approach ensures your agents are robust, well-tested, and observable in production environments.