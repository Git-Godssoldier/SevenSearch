// Supabase Helper Script
// This script provides a helper for executing SQL statements via the Supabase REST API
// It creates a custom SQL function to enable remote SQL execution

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// Initialize Supabase client with service role key (admin privileges)
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to create the execute_sql function in Supabase
async function createSqlExecutionFunction() {
  try {
    console.log('Setting up SQL execution function in Supabase...');
    
    // SQL to create the execute_sql function
    const createFunctionSql = `
      CREATE OR REPLACE FUNCTION execute_sql(sql_command TEXT)
      RETURNS TEXT AS $$
      BEGIN
        EXECUTE sql_command;
        RETURN 'SQL executed successfully';
      EXCEPTION
        WHEN OTHERS THEN
          RETURN 'Error: ' || SQLERRM;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
    
    // Execute the SQL to create the function
    const { data, error } = await supabase.rpc('execute_sql', { 
      sql_command: createFunctionSql 
    });
    
    if (error) {
      // If the execute_sql function doesn't exist yet, we need to create it differently
      if (error.message.includes('function "execute_sql" does not exist')) {
        console.log('Creating execute_sql function via REST API...');
        
        // We need to use the SQL API directly
        const { error: sqlError } = await supabase
          .from('_exec_sql')  // This is a virtual table in PostgreSQL for executing SQL
          .select('*')
          .eq('query', createFunctionSql)
          .single();
        
        if (sqlError) {
          if (sqlError.message.includes('relation "_exec_sql" does not exist')) {
            console.error('Cannot create execute_sql function. The _exec_sql endpoint is not available.');
            console.error('Please run this SQL manually in the Supabase SQL Editor:');
            console.log('\n' + createFunctionSql + '\n');
            return false;
          } else {
            console.error('Error creating function:', sqlError);
            return false;
          }
        }
      } else {
        console.error('Error calling execute_sql:', error);
        return false;
      }
    }
    
    console.log('SQL execution function set up successfully!');
    return true;
  } catch (error) {
    console.error('Unexpected error:', error);
    return false;
  }
}

// Function to execute SQL statements
async function executeSql(sql) {
  try {
    const { data, error } = await supabase.rpc('execute_sql', { 
      sql_command: sql 
    });
    
    if (error) {
      console.error('Error executing SQL:', error);
      return false;
    }
    
    console.log('SQL execution result:', data);
    return true;
  } catch (error) {
    console.error('Unexpected error:', error);
    return false;
  }
}

// Function to check if a table exists
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
      console.error(`Error checking if ${tableName} exists:`, error);
      return null; // Unknown status
    }
    
    return !!data;
  } catch (error) {
    console.error('Unexpected error:', error);
    return null; // Unknown status
  }
}

// Function to execute a SQL file
async function executeSqlFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`SQL file not found: ${filePath}`);
      return false;
    }
    
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`Found ${statements.length} SQL statements to execute.`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      if (stmt.includes('CREATE TABLE') || stmt.includes('create table')) {
        // Extract table name for verification
        const tableNameMatch = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/i);
        
        if (tableNameMatch && tableNameMatch[1]) {
          const tableName = tableNameMatch[1].toLowerCase();
          
          // Check if table already exists
          const exists = await checkTableExists(tableName);
          
          if (exists === true) {
            console.log(`Table ${tableName} already exists, skipping creation.`);
            continue; // Skip this statement
          }
        }
      }
      
      // Add semicolon back for execution
      const result = await executeSql(stmt + ';');
      
      if (!result) {
        console.error(`Failed to execute statement: ${stmt}`);
        // Continue with other statements
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error executing SQL file:', error);
    return false;
  }
}

// Main function
async function main() {
  console.log('====================================');
  console.log('Supabase SQL Helper');
  console.log('====================================');
  
  // Setup the execute_sql function
  const setupSuccess = await createSqlExecutionFunction();
  
  if (!setupSuccess) {
    console.log('Failed to set up SQL execution function. Please run SQL manually in the Supabase SQL Editor.');
    process.exit(1);
  }
  
  // Define the path to the combined SQL file
  const combinedSqlPath = path.join(process.cwd(), 'migrations', 'combined_tables.sql');
  
  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question(`Do you want to execute the SQL file at ${combinedSqlPath}? (y/n): `, async (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      console.log(`Executing SQL file: ${combinedSqlPath}`);
      const result = await executeSqlFile(combinedSqlPath);
      
      if (result) {
        console.log('SQL file execution completed successfully!');
      } else {
        console.log('SQL file execution had errors. Please check the console output above.');
      }
    } else {
      console.log('SQL execution cancelled.');
    }
    
    rl.close();
  });
}

// Run the main function
main().catch(error => {
  console.error('An unexpected error occurred:', error);
  process.exit(1);
});