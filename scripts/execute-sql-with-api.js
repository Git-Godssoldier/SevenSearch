// Supabase SQL Execution using REST API
// This script executes SQL in Supabase using the REST API
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Check for required environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Required environment variables are missing.');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

// Read SQL files
const sqlPath = path.join(__dirname, '..', 'migrations', 'output', 'formatted_sql.sql');
const extensionsPath = path.join(__dirname, '..', 'migrations', 'output', 'install_extensions.sql');

if (!fs.existsSync(sqlPath)) {
  console.error(`SQL file not found at ${sqlPath}`);
  process.exit(1);
}

if (!fs.existsSync(extensionsPath)) {
  console.error(`Extensions SQL file not found at ${extensionsPath}`);
  process.exit(1);
}

const sqlContent = fs.readFileSync(sqlPath, 'utf8');
const extensionsContent = fs.readFileSync(extensionsPath, 'utf8');

// Function to split SQL into manageable chunks
function splitSqlIntoChunks(sql, maxChunkSize = 10000) {
  // Split by semicolon to get individual statements
  const statements = sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);
  
  const chunks = [];
  let currentChunk = '';
  
  for (const statement of statements) {
    const statementWithSemicolon = statement + ';';
    
    if (currentChunk.length + statementWithSemicolon.length > maxChunkSize) {
      chunks.push(currentChunk);
      currentChunk = statementWithSemicolon;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + statementWithSemicolon;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// Function to execute SQL using curl and the REST API
async function executeSql(sql) {
  try {
    // Create a temporary file with the SQL
    const tempFile = path.join(__dirname, 'temp-sql.sql');
    fs.writeFileSync(tempFile, sql);
    
    // Build the curl command
    const curlCommand = `
      curl -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \\
      -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \\
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \\
      -H "Content-Type: application/json" \\
      -d '{"sql": ${JSON.stringify(sql)}}'
    `;
    
    // Execute the curl command
    console.log('Executing SQL...');
    const result = execSync(curlCommand).toString();
    
    // Clean up the temporary file
    fs.unlinkSync(tempFile);
    
    return result;
  } catch (error) {
    console.error('Error executing SQL:', error.message);
    
    // Check if the error is related to 'exec_sql' function not existing
    if (error.message.includes('function "exec_sql" does not exist')) {
      console.log('\nCreating the exec_sql function...');
      
      // SQL to create the exec_sql function
      const createFunctionSql = `
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
      `;
      
      try {
        // Try to create the function
        const tempFile = path.join(__dirname, 'create-function.sql');
        fs.writeFileSync(tempFile, createFunctionSql);
        
        const createFunctionCommand = `
          curl -X POST "${SUPABASE_URL}/rest/v1/sql" \\
          -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \\
          -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \\
          -H "Content-Type: application/json" \\
          -d '{"query": ${JSON.stringify(createFunctionSql)}}'
        `;
        
        const result = execSync(createFunctionCommand).toString();
        fs.unlinkSync(tempFile);
        
        console.log('exec_sql function created successfully. Retrying the SQL execution...');
        return executeSql(sql);
      } catch (funcError) {
        console.error('Error creating exec_sql function:', funcError.message);
        throw funcError;
      }
    }
    
    throw error;
  }
}

// Function to check if the SQL can be executed directly without a function
async function executeSqlDirect(sql) {
  try {
    const curlCommand = `
      curl -X POST "${SUPABASE_URL}/rest/v1/sql" \\
      -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \\
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \\
      -H "Content-Type: application/json" \\
      -d '{"query": ${JSON.stringify(sql)}}'
    `;
    
    console.log('Executing SQL directly...');
    const result = execSync(curlCommand).toString();
    return result;
  } catch (error) {
    console.error('Error executing SQL directly:', error.message);
    throw error;
  }
}

// Main function to execute the SQL statements
async function main() {
  console.log('======================================');
  console.log('Supabase SQL Execution using REST API');
  console.log('======================================');
  
  try {
    // First, install extensions
    console.log('\nInstalling required extensions...');
    try {
      const extensionsResult = await executeSqlDirect(extensionsContent);
      console.log('Extensions installed successfully:', extensionsResult);
    } catch (error) {
      console.log('Could not install extensions directly. Trying alternate method...');
      try {
        const extensionsResult = await executeSql(extensionsContent);
        console.log('Extensions installed successfully using exec_sql:', extensionsResult);
      } catch (innerError) {
        console.error('Failed to install extensions:', innerError.message);
        console.log('Continuing with table creation anyway...');
      }
    }
    
    // Split the main SQL into chunks
    const sqlChunks = splitSqlIntoChunks(sqlContent);
    console.log(`\nSQL has been split into ${sqlChunks.length} chunks for execution.`);
    
    // Execute each chunk
    for (let i = 0; i < sqlChunks.length; i++) {
      console.log(`\nExecuting SQL chunk ${i + 1} of ${sqlChunks.length}...`);
      
      try {
        // Try direct execution first
        const result = await executeSqlDirect(sqlChunks[i]);
        console.log(`Chunk ${i + 1} executed successfully.`);
      } catch (error) {
        console.log(`Direct execution failed for chunk ${i + 1}. Trying with exec_sql...`);
        
        try {
          // Try with exec_sql function
          const result = await executeSql(sqlChunks[i]);
          console.log(`Chunk ${i + 1} executed successfully with exec_sql.`);
        } catch (innerError) {
          console.error(`Failed to execute chunk ${i + 1}:`, innerError.message);
          
          // Write the failed chunk to a file for manual execution
          const failedChunkPath = path.join(__dirname, '..', 'migrations', 'output', `failed_chunk_${i + 1}.sql`);
          fs.writeFileSync(failedChunkPath, sqlChunks[i]);
          console.log(`The failed SQL has been saved to ${failedChunkPath} for manual execution.`);
          
          // Continue with the next chunk
          continue;
        }
      }
    }
    
    console.log('\n======================================');
    console.log('SQL execution completed!');
    console.log('======================================');
    
    // Check for any failed chunks
    const outputDir = path.join(__dirname, '..', 'migrations', 'output');
    const failedChunks = fs.readdirSync(outputDir)
      .filter(file => file.startsWith('failed_chunk_'));
    
    if (failedChunks.length > 0) {
      console.log(`\nNote: ${failedChunks.length} SQL chunks failed execution and were saved for manual execution:`);
      failedChunks.forEach(file => console.log(`- ${path.join(outputDir, file)}`));
      console.log('\nYou can execute these files manually in the Supabase SQL Editor.');
    } else {
      console.log('\nAll SQL chunks were executed successfully!');
    }
    
    // Verify tables were created
    console.log('\nVerifying table creation...');
    try {
      const verificationSql = `
        SELECT table_name, to_char(create_time, 'YYYY-MM-DD HH24:MI:SS') as created_at
        FROM (
          SELECT tablename as table_name, max(create_time) as create_time
          FROM pg_tables LEFT JOIN pg_stat_user_tables ON tablename = relname
          WHERE schemaname = 'public'
          GROUP BY tablename
        ) t
        ORDER BY created_at DESC;
      `;
      
      const verificationResult = await executeSqlDirect(verificationSql);
      console.log('Tables created in the database:');
      console.log(verificationResult);
    } catch (error) {
      console.error('Could not verify table creation:', error.message);
    }
    
  } catch (error) {
    console.error('An unexpected error occurred:', error.message);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});