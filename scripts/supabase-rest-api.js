// Supabase REST API Helper
// This script provides access to the Supabase PostgreSQL-Meta API for creating tables and schema objects

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase credentials. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// Configure Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// REST API endpoints for Postgres Meta API
const REST_BASE_URL = `${supabaseUrl}/rest/v1`;
const PG_META_BASE_URL = `${supabaseUrl}/pg-meta`;

// Helper for making authenticated requests to postgres-meta
async function pgMetaRequest(endpoint, method = 'GET', body = null) {
  const url = `${PG_META_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': supabaseServiceRoleKey,
    'Authorization': `Bearer ${supabaseServiceRoleKey}`
  };

  const options = {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  };

  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }
    
    if (response.status === 204) {
      return null; // No content
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error making postgres-meta request to ${endpoint}:`, error.message);
    throw error;
  }
}

// Function to check if postgres-meta API is available
async function checkPgMetaApiAvailability() {
  try {
    // Try to access a basic endpoint
    await pgMetaRequest('/tables');
    console.log('postgres-meta API is available!');
    return true;
  } catch (error) {
    console.error('postgres-meta API is not available:', error.message);
    console.error('You may need to enable the postgres-meta extension in your Supabase project.');
    return false;
  }
}

// Function to get list of tables
async function getTables() {
  try {
    const tables = await pgMetaRequest('/tables?schema=public');
    return tables;
  } catch (error) {
    console.error('Error getting tables:', error.message);
    return [];
  }
}

// Function to check if a table exists
async function tableExists(tableName) {
  try {
    const tables = await getTables();
    return tables.some(table => table.name === tableName);
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error.message);
    return false;
  }
}

// Function to create a table
async function createTable(tableDef) {
  try {
    const result = await pgMetaRequest('/tables', 'POST', tableDef);
    console.log(`Table ${tableDef.name} created successfully!`);
    return result;
  } catch (error) {
    console.error(`Error creating table ${tableDef.name}:`, error.message);
    return null;
  }
}

// Function to execute a query
async function executeQuery(query) {
  try {
    const result = await pgMetaRequest('/query', 'POST', { query });
    return result;
  } catch (error) {
    console.error('Error executing query:', error.message);
    throw error;
  }
}

// Function to parse SQL and extract table definitions
function parseSqlTableDefinitions(sql) {
  // This is a simplified parser for demonstration
  // A proper SQL parser would be more complex
  
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)(?:\);)/gi;
  const tables = [];
  
  let match;
  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1].replace(/['"]/g, '').trim();
    const columnsText = match[2].trim();
    
    const columns = parseColumns(columnsText);
    
    tables.push({
      name: tableName,
      schema: 'public',
      columns
    });
  }
  
  return tables;
}

// Function to parse column definitions
function parseColumns(columnsText) {
  // Split by commas, but ignore commas inside parentheses 
  // This is a simplified approach - a proper SQL parser would be better
  const columnLines = [];
  let depth = 0;
  let currentLine = '';
  
  for (let i = 0; i < columnsText.length; i++) {
    const char = columnsText[i];
    
    if (char === '(' || char === '[' || char === '{') {
      depth++;
    } else if (char === ')' || char === ']' || char === '}') {
      depth--;
    }
    
    if (char === ',' && depth === 0) {
      columnLines.push(currentLine.trim());
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  
  if (currentLine.trim()) {
    columnLines.push(currentLine.trim());
  }
  
  // Now parse each column line
  return columnLines
    .filter(line => {
      // Filter out constraints and other non-column definitions
      const isPrimaryKey = line.toUpperCase().includes('PRIMARY KEY') && !line.includes(' ');
      const isUnique = line.toUpperCase().includes('UNIQUE') && !line.includes(' ');
      const isConstraint = line.toUpperCase().includes('CONSTRAINT');
      
      return !(isPrimaryKey || isUnique || isConstraint);
    })
    .map(line => {
      // Extract column details
      const parts = line.split(/\s+/);
      const name = parts[0].replace(/['"]/g, '');
      
      // Determine data type and nullable
      let dataType = '';
      let nullable = true;
      
      for (let i = 1; i < parts.length; i++) {
        if (parts[i].toUpperCase() === 'NOT' && parts[i+1]?.toUpperCase() === 'NULL') {
          nullable = false;
          i++; // Skip the NULL part
        } else if (!dataType) {
          dataType = parts[i];
        }
      }
      
      return {
        name,
        type: dataType,
        isNullable: nullable,
        isPrimaryKey: line.toUpperCase().includes('PRIMARY KEY'),
        isUnique: line.toUpperCase().includes('UNIQUE')
      };
    });
}

// Main function to create tables from SQL file
async function createTablesFromSqlFile(sqlFilePath) {
  try {
    // Check if postgres-meta API is available
    const isAvailable = await checkPgMetaApiAvailability();
    if (!isAvailable) {
      console.log('Using fallback method to create tables...');
      return await createTablesWithFallback(sqlFilePath);
    }
    
    console.log(`Reading SQL file: ${sqlFilePath}`);
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Parse SQL to extract table definitions
    const tableDefinitions = parseSqlTableDefinitions(sql);
    console.log(`Found ${tableDefinitions.length} table definitions in the SQL file.`);
    
    // Create each table
    for (const tableDef of tableDefinitions) {
      console.log(`Processing table: ${tableDef.name}`);
      
      // Check if table already exists
      const exists = await tableExists(tableDef.name);
      if (exists) {
        console.log(`Table ${tableDef.name} already exists, skipping.`);
        continue;
      }
      
      // Create the table
      const result = await createTable(tableDef);
      if (result) {
        console.log(`Table ${tableDef.name} created successfully.`);
      }
    }
    
    // Execute additional SQL for constraints, triggers, etc.
    console.log('Executing additional SQL for constraints, triggers, and policies...');
    const additionalSql = extractNonTableSql(sql);
    if (additionalSql) {
      await executeQuery(additionalSql);
      console.log('Additional SQL executed successfully.');
    }
    
    return true;
  } catch (error) {
    console.error('Error creating tables from SQL file:', error.message);
    return false;
  }
}

// Extract non-table creation SQL (constraints, triggers, etc.)
function extractNonTableSql(sql) {
  // Remove all CREATE TABLE statements
  let nonTableSql = sql.replace(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?[a-zA-Z0-9_]+\s*\([\s\S]*?\);/gi, '');
  
  // Remove comments
  nonTableSql = nonTableSql.replace(/--.*$/gm, '');
  
  // Trim and clean up
  nonTableSql = nonTableSql.trim();
  
  return nonTableSql;
}

// Fallback method using Supabase client to execute SQL
async function createTablesWithFallback(sqlFilePath) {
  try {
    console.log(`Reading SQL file: ${sqlFilePath}`);
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Try using Supabase SQL API directly
    const { error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      if (error.message.includes('function "exec_sql" does not exist')) {
        console.error('The exec_sql function is not available.');
        console.log('Please execute the SQL statements manually in the Supabase SQL Editor:');
        console.log('\n' + sql + '\n');
        return false;
      } else {
        console.error('Error executing SQL:', error);
        return false;
      }
    }
    
    console.log('SQL executed successfully!');
    return true;
  } catch (error) {
    console.error('Error with fallback method:', error.message);
    return false;
  }
}

// Main execution
async function main() {
  console.log('====================================');
  console.log('Supabase REST API Helper');
  console.log('====================================');
  
  // Path to the SQL file
  const sqlFilePath = path.join(process.cwd(), 'migrations', 'combined_tables.sql');
  if (!fs.existsSync(sqlFilePath)) {
    console.error(`SQL file not found at ${sqlFilePath}`);
    process.exit(1);
  }
  
  try {
    console.log('Attempting to create tables via REST API...');
    const success = await createTablesFromSqlFile(sqlFilePath);
    
    if (success) {
      console.log('Tables created successfully!');
    } else {
      console.log('Failed to create all tables. Please check the errors above.');
    }
  } catch (error) {
    console.error('An unexpected error occurred:', error);
  }
}

// Run the main function if this script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('An unexpected error occurred:', error);
    process.exit(1);
  });
}

// Export functions for use in other scripts
module.exports = {
  createTablesFromSqlFile,
  getTables,
  tableExists,
  createTable,
  executeQuery
};