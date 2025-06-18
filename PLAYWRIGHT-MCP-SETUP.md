# Setting Up Microsoft Playwright MCP for Supabase SQL Automation

This guide explains how to set up and use Microsoft's Playwright MCP to automate SQL execution in Supabase.

## What is Playwright MCP?

Microsoft's Playwright MCP is a Model Context Protocol server that wraps Playwright, providing browser automation capabilities to tools like Claude. It uses the Chrome accessibility tree to help LLMs navigate and interact with web pages.

## Installing Playwright MCP

### Option 1: Using Claude Desktop

1. Install Node.js if you don't already have it

2. Configure Claude Desktop to use Playwright MCP:
   ```bash
   # On macOS
   code ~/Library/Application\ Support/Claude/claude_desktop_config.json
   
   # On Windows
   code %AppData%\Claude\claude_desktop_config.json
   ```

3. Add this configuration:
   ```json
   {
     "mcpServers": {
       "playwright": {
         "command": "npx",
         "args": [
           "@playwright/mcp@latest"
         ]
       }
     }
   }
   ```

4. Save the file and restart Claude Desktop

### Option 2: Using Smithery for Claude Desktop

If you have Smithery installed, run:
```bash
npx -y @smithery/cli install @executeautomation/playwright-mcp-server --client claude
```

### Option 3: Using the Execute Automation Playwright MCP

This is an alternative MCP server with enhanced capabilities:

1. Install globally:
   ```bash
   npm install -g @executeautomation/playwright-mcp-server
   ```

2. Configure Claude Desktop:
   ```json
   {
     "mcpServers": {
       "playwright": {
         "command": "npx",
         "args": [
           "-y",
           "@executeautomation/playwright-mcp-server"
         ]
       }
     }
   }
   ```

## Available Browser Automation Tools

Once installed, you'll have access to these tools:

### Navigation Tools
- **browser_navigate**: Navigate to a specific URL
- **browser_go_back**: Navigate back in browser history
- **browser_go_forward**: Navigate forward in browser history
- **browser_wait**: Wait for a specified time in seconds
- **browser_press_key**: Press a keyboard key
- **browser_save_as_pdf**: Save current page as PDF
- **browser_close**: Close the current page

### Screenshot and Mouse Tools
- **browser_screenshot**: Take a screenshot of the current page
- **browser_move_mouse**: Move mouse to specific coordinates
- **browser_click**: Click at specific coordinates
- **browser_drag**: Drag mouse from one position to another
- **browser_type**: Type text and optionally submit

### Accessibility Tools
- **browser_snapshot**: Capture accessibility structure of the page
- **browser_click**: Click on a specific element using accessibility reference
- **browser_hover**: Hover over an element
- **browser_type**: Type text into a specific element

## Automating Supabase SQL Execution

Here's an example sequence for executing SQL in Supabase:

```
1. Navigate to Supabase login page
   browser_navigate(url="https://app.supabase.com/")

2. Log in with credentials
   browser_type(selector=".selector-for-email-field", text="your-email@example.com")
   browser_type(selector=".selector-for-password-field", text="your-password")
   browser_click(selector=".selector-for-login-button")

3. Navigate to your project
   browser_click(selector=".selector-for-your-project")

4. Go to SQL Editor
   browser_click(selector=".selector-for-sql-editor")

5. Type and execute SQL
   browser_type(selector=".monaco-editor textarea", text="CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")
   browser_click(selector=".selector-for-run-button")
```

To execute multiple SQL statements:
1. Break down your SQL into manageable chunks
2. For each chunk:
   - Clear the editor if needed
   - Type the SQL chunk
   - Execute it
   - Wait for completion

## Troubleshooting

- **MCP not working**: Ensure Node.js is properly installed and the configuration file is correct
- **Navigation issues**: Check if selectors are correct; take screenshots to verify page state
- **Permissions**: Supabase SQL Editor may require specific permissions; ensure you're using the service role

## Additional Resources

- [Microsoft Playwright MCP GitHub](https://github.com/microsoft/playwright-mcp)
- [ExecuteAutomation Playwright MCP](https://github.com/executeautomation/mcp-playwright)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Supabase Documentation](https://supabase.com/docs)

For detailed examples and more complex automation scenarios, refer to the full documentation of the MCP server you're using.