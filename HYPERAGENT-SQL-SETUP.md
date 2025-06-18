# Supabase SQL Setup with HyperAgent

This guide explains how to use HyperAgent to automate the SQL execution for creating database tables in Supabase.

## Overview

The HyperAgent setup automates:
- Opening a browser session and navigating to Supabase
- Executing SQL statements for installing required extensions 
- Creating all required tables with their indexes, triggers, and policies
- Verifying successful table creation

## Key Features

- **AI-Powered Automation**: Uses HyperAgent (built on Playwright) with AI capabilities
- **Interactive**: Waits for your login and guides you through the process
- **Reliable**: Executes SQL in manageable chunks for better reliability
- **Verification**: Automatically verifies table creation at the end

## Prerequisites

- Node.js installed
- Internet connection
- Supabase account credentials

## Quick Start

1. Navigate to the scripts directory:
   ```bash
   cd scripts
   ```

2. Run the installation script:
   ```bash
   ./install-hyperagent.sh
   ```

3. Follow the terminal prompts:
   - A browser window will open and navigate to Supabase
   - Log in with your credentials
   - Navigate to the SQL Editor
   - Press Enter in the terminal to continue with SQL execution

## How It Works

1. HyperAgent opens a browser session and navigates to Supabase
2. You log in and navigate to the SQL Editor
3. HyperAgent executes SQL in this order:
   - First installs the required extensions (uuid-ossp)
   - Then creates all database tables and related objects
   - Finally verifies the tables were created successfully

## Troubleshooting

If you encounter any issues:

1. **Browser not opening**: Make sure you have a working internet connection

2. **SQL execution errors**: 
   - Check the terminal for error messages
   - The browser remains open for manual verification
   - You can manually execute any failed SQL statements

3. **Authentication issues**:
   - Ensure you have valid Supabase credentials
   - The script waits for you to complete the login process

## Additional Resources

- SQL scripts are located in the `migrations/output` directory
- Individual table SQL files are in `migrations/output/tables` for manual execution if needed
- Extension check and installation SQL is in `migrations/output/check_extensions.sql` and `migrations/output/install_extensions.sql`