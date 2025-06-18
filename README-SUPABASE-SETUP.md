# Supabase Database Setup Guide

This document provides several methods for setting up the database tables required for the application. Choose the approach that works best for your workflow.

## Prerequisites

- Supabase project with credentials
- Node.js installed
- Proper environment variables set up in `.env.local`

## Environment Setup

Make sure your `.env.local` file has the following Supabase-related variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Option 1: Using the Supabase CLI (Recommended)

This approach uses the Supabase CLI to create migration files and apply them to your database.

### Install Supabase CLI

```bash
npm install -g supabase
```

### Setup and Push Migrations

```bash
# Run the CLI setup helper
node scripts/setup-supabase-cli.js
```

This script will:
1. Initialize a Supabase project locally
2. Link to your remote Supabase project
3. Create migration files for each table
4. Optionally push migrations to your remote database

### Manual Supabase CLI Commands

If you prefer to run the commands manually:

```bash
# Initialize Supabase project
supabase init

# Link to remote project (replace with your project ID)
supabase link --project-ref your-project-id

# Create migration file for each table
supabase migration new create_users_table
supabase migration new create_searches_table
# etc.

# Push migrations to remote database
supabase db push
```

## Option 2: Using the SQL Editor in Supabase Dashboard

This approach generates formatted SQL for you to execute in the Supabase Dashboard.

### Generate Formatted SQL

```bash
# Install required dependency first
npm install copy-paste

# Run the SQL generator
node scripts/sql-statement-generator.js
```

This script will:
1. Format the SQL for better readability
2. Split it into manageable chunks if necessary
3. Copy the first chunk to your clipboard
4. Generate formatted SQL files in the `migrations/output` directory

### Execute SQL in Dashboard

1. Log in to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Paste the SQL from your clipboard or from the generated files
4. Click "Run" to execute the SQL statements
5. If using multiple chunks, execute them in order (part_1, part_2, etc.)

## Option 3: Using the Supabase REST API

This approach attempts to create tables programmatically using the Supabase REST API.

```bash
# Run the REST API helper
node scripts/supabase-rest-api.js
```

This script will:
1. Try to use the postgres-meta API to create tables
2. Fall back to other methods if postgres-meta is not available
3. Parse the SQL to extract table definitions
4. Create tables and execute additional SQL for constraints, triggers, etc.

## Option 4: Using the SQL Helper with Custom Function

This approach creates a custom SQL execution function and uses it to run SQL statements.

```bash
# Install required dependencies
npm install @supabase/supabase-js dotenv

# Run the Supabase helper
node scripts/supabase-helper.js
```

This script will:
1. Create an `execute_sql` function in your Supabase database
2. Use this function to execute the SQL statements
3. Skip table creation if the table already exists

## Troubleshooting

### Common Errors

1. **"function "execute_sql" does not exist"**: This occurs when trying to use option 4 without first setting up the custom function. The script should try to create the function automatically.

2. **"relation does not exist"**: This might happen if you're trying to create dependent objects (like indexes or policies) before the table exists. Make sure to execute the CREATE TABLE statements first.

3. **"permission denied"**: Ensure you're using the service role key, not the anon key.

### Verifying Table Creation

To check if tables were created successfully:

```bash
# Run the table check script
node scripts/check-tables.js
```

Or manually check in the Supabase Dashboard under "Database" > "Tables".

## Additional Notes

- The combined SQL script is in `migrations/combined_tables.sql`
- Table creation is idempotent (IF NOT EXISTS) to prevent errors on repeated execution
- Row Level Security (RLS) is enabled on all tables
- All necessary indexes are created for performance optimization

For more help or to report issues, please contact the development team.