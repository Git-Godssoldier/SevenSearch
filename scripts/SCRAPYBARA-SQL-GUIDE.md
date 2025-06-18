# Executing SQL in Supabase with Scrapybara MCP

This guide explains how to use Scrapybara MCP (Model Context Protocol) to automate SQL execution in Supabase. Scrapybara provides a virtual Ubuntu environment with browser capabilities, making it ideal for automating web interactions like executing SQL in the Supabase SQL Editor.

## Prerequisites

- Node.js 18+ installed
- Supabase account with login credentials
- Scrapybara API key
- Environment variables properly configured

## Setup

1. Ensure your `.env.local` file contains the following variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_LOGIN_EMAIL=your-email@example.com
   SUPABASE_LOGIN_PASSWORD=your-password
   SCRAPYBARA_API_KEY=your-scrapybara-api-key
   ```

2. Install the required dependencies:
   ```bash
   npm install dotenv
   npm install -g @mastra/cli
   ```

## Starting the Scrapybara MCP Server

Use the `start-mcp-servers.js` script to start the Scrapybara MCP server:

```bash
node scripts/start-mcp-servers.js scrapybara
```

This will start the Scrapybara MCP server with your API key configured.

## Executing SQL with Scrapybara

The `scrapybara-execute-sql.js` script automates the process of logging into Supabase and executing SQL in the SQL Editor.

To execute SQL:

```bash
node scripts/scrapybara-execute-sql.js path/to/your/sql-file.sql
```

If no SQL file is provided, the script will use the combined SQL file from the migrations folder.

## How It Works

1. The script starts by loading environment variables and SQL content
2. SQL is split into manageable chunks to avoid limits in the SQL Editor
3. A temporary Python script is created to:
   - Launch a Chrome browser via Selenium (inside Scrapybara's environment)
   - Navigate to the Supabase SQL Editor
   - Log in with provided credentials
   - Execute each SQL chunk sequentially
   - Report on the execution status
4. Scrapybara MCP executes this Python script in its secure container
5. Results are returned to the Node.js environment

## Troubleshooting

- **Authentication Issues**: Ensure your Supabase email and password are correct in the .env.local file
- **API Key Issues**: Verify your Scrapybara API key is correct and active
- **Execution Timeout**: For large SQL files, the script breaks SQL into chunks, but very complex operations might still timeout. Consider splitting your SQL into smaller, separate files.
- **MCP Server Connection**: If you can't connect to the MCP server, ensure it's running using the start-mcp-servers.js script

## Advanced Usage

You can modify the `scrapybara-execute-sql.js` script to:

- Change the chunk size (default 15000 characters)
- Adjust timeouts for longer-running queries
- Add specific error handling for your SQL operations
- Implement retries for failed queries

## Notes

- Scrapybara executes in a containerized environment, so it cannot access files on your local system unless explicitly passed through the MCP protocol.
- This approach is particularly useful for automating repetitive SQL tasks in Supabase that require browser interaction.
- The script automatically cleans up temporary files after execution.