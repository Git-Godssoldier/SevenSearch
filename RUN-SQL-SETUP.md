# Supabase SQL Setup

This guide explains how to execute the SQL scripts to set up the database tables in Supabase.

## Option 1: REST API Method (Recommended)

The fastest and most reliable way to execute the SQL is using our REST API script:

```bash
cd scripts
node execute-sql-with-api.js
```

This script will:
1. Install the required extensions (uuid-ossp)
2. Execute all SQL statements to create tables, indexes, policies, etc.
3. Verify the tables were created successfully
4. If any SQL chunk fails, it will save it to a file for manual execution

## Option 2: Manual Execution in SQL Editor

If the REST API method doesn't work, you can execute the SQL manually in the Supabase SQL Editor:

1. Log in to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy the SQL from the following files and execute them in order:
   - First: `migrations/output/install_extensions.sql`
   - Then: `migrations/output/formatted_sql.sql`

For larger SQL files, you can use the chunked versions:
- `migrations/output/chunks/chunk_1_of_X.sql`
- `migrations/output/chunks/chunk_2_of_X.sql`
- And so on...

## Option 3: Supabase CLI (For Development)

If you're developing locally and have the Supabase CLI installed, you can use:

```bash
# Initialize Supabase project
supabase init

# Link to your remote project
supabase link --project-ref <your-project-ref>

# Create migrations
supabase migration new create_tables

# Copy SQL to the created migration file
# Then push migrations to remote
supabase db push
```

## Verifying Table Creation

After running the setup, you can verify the tables were created by running this SQL in the SQL Editor:

```sql
SELECT table_name, to_char(create_time, 'YYYY-MM-DD HH24:MI:SS') as created_at
FROM (
  SELECT tablename as table_name, max(create_time) as create_time
  FROM pg_tables LEFT JOIN pg_stat_user_tables ON tablename = relname
  WHERE schemaname = 'public'
  GROUP BY tablename
) t
ORDER BY created_at DESC;
```

You should see all your tables listed:
- users
- searches
- suspended_workflows
- tasks
- workflow_planning

## Troubleshooting

If you encounter errors:

1. **Extension errors**: Ensure the uuid-ossp extension is installed first

2. **Permission errors**: Make sure you're using the service_role key, not the anon key

3. **Existing tables**: The SQL uses `IF NOT EXISTS` to avoid errors if tables already exist

4. **Function errors**: If you see "function exec_sql does not exist", you might need to manually create the function in the SQL Editor:

```sql
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS text AS $$
BEGIN
  EXECUTE sql;
  RETURN 'SQL executed successfully';
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'Error: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

For additional help, check the SQL files in the `migrations/output` directory or refer to the Supabase documentation.