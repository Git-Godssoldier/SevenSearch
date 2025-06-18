// Check Tables Script
// This script checks which tables exist in the Supabase database

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseKey);

// List of tables to check
const TABLES_TO_CHECK = [
  'users',
  'searches',
  'suspended_workflows',
  'tasks',
  'workflow_planning'
];

// Function to check if table exists
async function checkTableExists(tableName) {
  try {
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', tableName)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // Table not found
        return false;
      }
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error(`Error checking if ${tableName} exists:`, error);
    return null; // Unknown status
  }
}

// Function to get table details
async function getTableDetails(tableName) {
  try {
    // Get column information
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', tableName);
    
    if (columnsError) {
      throw columnsError;
    }
    
    // Check for indexes
    const { data: indexes, error: indexesError } = await supabase
      .from('pg_indexes')
      .select('indexname, indexdef')
      .eq('schemaname', 'public')
      .eq('tablename', tableName);
    
    if (indexesError) {
      throw indexesError;
    }
    
    // Check for row level security
    // This is more complex and requires a direct SQL query
    const { data: rls, error: rlsError } = await supabase
      .rpc('check_rls_enabled', { table_name: tableName })
      .single();
    
    const rlsEnabled = !rlsError && rls ? rls : 'Unknown';
    
    return {
      columns: columns || [],
      indexes: indexes || [],
      rlsEnabled
    };
  } catch (error) {
    console.error(`Error getting details for ${tableName}:`, error);
    return {
      columns: [],
      indexes: [],
      rlsEnabled: 'Unknown'
    };
  }
}

// Create RPC function to check RLS if it doesn't exist
async function createRlsCheckFunction() {
  try {
    const functionDefinition = `
      CREATE OR REPLACE FUNCTION check_rls_enabled(table_name TEXT)
      RETURNS BOOLEAN AS $$
      DECLARE
          result BOOLEAN;
      BEGIN
          EXECUTE 'SELECT relhaspolicy FROM pg_class WHERE relname = $1 AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = ''public'')'
          INTO result
          USING table_name;
          RETURN result;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    // Try to create the function
    const { error } = await supabase.rpc('execute_sql', { 
      sql_command: functionDefinition 
    });
    
    if (error) {
      // The execute_sql function might not exist yet
      console.warn('Could not create RLS check function, RLS status will be shown as "Unknown"');
      return false;
    }
    
    return true;
  } catch (error) {
    console.warn('Error creating RLS check function:', error);
    return false;
  }
}

// Main function
async function main() {
  console.log('====================================');
  console.log('Supabase Table Check');
  console.log('====================================');
  
  // Try to create the RLS check function
  await createRlsCheckFunction();
  
  console.log(`Checking tables in Supabase project: ${supabaseUrl}`);
  console.log('------------------------------------');
  
  const results = {};
  let existingCount = 0;
  
  // Check each table
  for (const tableName of TABLES_TO_CHECK) {
    const exists = await checkTableExists(tableName);
    
    results[tableName] = {
      exists,
      details: exists ? await getTableDetails(tableName) : null
    };
    
    if (exists) {
      existingCount++;
    }
  }
  
  // Display results
  console.log('\nTable Status:');
  console.log('-------------');
  
  for (const [tableName, info] of Object.entries(results)) {
    const status = info.exists 
      ? '✅ Exists' 
      : '❌ Missing';
    
    console.log(`${tableName}: ${status}`);
    
    if (info.exists && info.details) {
      console.log(`  - Columns: ${info.details.columns.length}`);
      console.log(`  - Indexes: ${info.details.indexes.length}`);
      console.log(`  - RLS: ${info.details.rlsEnabled ? 'Enabled' : 'Disabled'}`);
    }
  }
  
  console.log('\nSummary:');
  console.log('--------');
  console.log(`${existingCount} of ${TABLES_TO_CHECK.length} required tables exist in the database.`);
  
  if (existingCount < TABLES_TO_CHECK.length) {
    console.log('\nMissing tables:');
    for (const [tableName, info] of Object.entries(results)) {
      if (!info.exists) {
        console.log(`- ${tableName}`);
      }
    }
    
    console.log('\nYou can create the missing tables using one of the methods in README-SUPABASE-SETUP.md');
  } else {
    console.log('\nAll required tables exist! Your database setup is complete. 🎉');
  }
}

// Run the main function
main().catch(error => {
  console.error('An unexpected error occurred:', error);
  process.exit(1);
});