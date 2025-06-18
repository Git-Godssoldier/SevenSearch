// Supabase CLI Setup Script
// This script helps set up Supabase CLI and create migration files for table creation

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Constants and configuration
const PROJECT_ID = process.env.SUPABASE_PROJECT_ID || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Utility functions
function checkPrerequisites() {
  try {
    const supabaseVersion = execSync('supabase --version').toString().trim();
    console.log(`Supabase CLI detected: ${supabaseVersion}`);
    return true;
  } catch (error) {
    console.error('Supabase CLI not installed. Please install it first:');
    console.error('npm install -g supabase');
    return false;
  }
}

function initializeSupabase() {
  try {
    // Check if .supabase folder already exists
    if (!fs.existsSync(path.join(process.cwd(), '.supabase'))) {
      console.log('Initializing Supabase project...');
      execSync('supabase init', { stdio: 'inherit' });
    } else {
      console.log('Supabase project already initialized.');
    }
    return true;
  } catch (error) {
    console.error('Failed to initialize Supabase:', error.message);
    return false;
  }
}

function linkRemoteProject() {
  if (!PROJECT_ID) {
    console.error('Project ID not provided. Please set SUPABASE_PROJECT_ID environment variable.');
    console.error('You can find your project ID in the Supabase dashboard URL: https://supabase.com/dashboard/project/<project-id>');
    return false;
  }

  try {
    console.log(`Linking to remote Supabase project: ${PROJECT_ID}`);
    execSync(`supabase link --project-ref ${PROJECT_ID}`, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error('Failed to link remote project:', error.message);
    return false;
  }
}

function createMigrationFiles() {
  // List of table migration files to create
  const tables = [
    { name: 'users', migration: '01_create_users_table' },
    { name: 'searches', migration: '02_create_searches_table' },
    { name: 'suspended_workflows', migration: '03_create_suspended_workflows_table' },
    { name: 'tasks', migration: '04_create_tasks_table' },
    { name: 'workflow_planning', migration: '05_create_workflow_planning_table' }
  ];

  // Read the combined SQL file
  const combinedSqlPath = path.join(process.cwd(), 'migrations', 'combined_tables.sql');
  if (!fs.existsSync(combinedSqlPath)) {
    console.error(`Combined SQL file not found at ${combinedSqlPath}`);
    return false;
  }

  const combinedSql = fs.readFileSync(combinedSqlPath, 'utf8');

  // Create migration directory if it doesn't exist
  const migrationDir = path.join(process.cwd(), 'supabase', 'migrations');
  if (!fs.existsSync(migrationDir)) {
    fs.mkdirSync(migrationDir, { recursive: true });
  }

  // Extract and create individual migration files
  for (const table of tables) {
    try {
      console.log(`Creating migration for ${table.name} table...`);
      
      // Create a new migration file
      const result = execSync(`supabase migration new ${table.migration}`, { encoding: 'utf8' });
      console.log(result);
      
      // Get the filename of the created migration
      const files = fs.readdirSync(migrationDir);
      const migrationFile = files.find(file => file.endsWith(`${table.migration}.sql`));
      
      if (!migrationFile) {
        console.error(`Failed to find migration file for ${table.name}`);
        continue;
      }
      
      const migrationPath = path.join(migrationDir, migrationFile);
      
      // Extract SQL for this table from combined SQL
      let tableSql = '';
      
      if (table.name === 'users') {
        // For users table, extract from "-- 1. Create users table" to before "-- 2. Create searches table"
        tableSql = combinedSql.substring(
          combinedSql.indexOf('-- 1. Create users table'),
          combinedSql.indexOf('-- 2. Create searches table')
        );
      } else if (table.name === 'searches') {
        // For searches table, extract from "-- 2. Create searches table" to before "-- 3. Create suspended_workflows table"
        tableSql = combinedSql.substring(
          combinedSql.indexOf('-- 2. Create searches table'),
          combinedSql.indexOf('-- 3. Create suspended_workflows table')
        );
      } else if (table.name === 'suspended_workflows') {
        // For suspended_workflows table, extract from "-- 3. Create suspended_workflows table" to before "-- 4. Create tasks table"
        tableSql = combinedSql.substring(
          combinedSql.indexOf('-- 3. Create suspended_workflows table'),
          combinedSql.indexOf('-- 4. Create tasks table')
        );
      } else if (table.name === 'tasks') {
        // For tasks table, extract from "-- 4. Create tasks table" to before "-- 5. Create workflow_planning table"
        tableSql = combinedSql.substring(
          combinedSql.indexOf('-- 4. Create tasks table'),
          combinedSql.indexOf('-- 5. Create workflow_planning table')
        );
      } else if (table.name === 'workflow_planning') {
        // For workflow_planning table, extract from "-- 5. Create workflow_planning table" to the end
        tableSql = combinedSql.substring(
          combinedSql.indexOf('-- 5. Create workflow_planning table')
        );
      }
      
      // Write the extracted SQL to the migration file
      fs.writeFileSync(migrationPath, tableSql.trim());
      console.log(`Migration created for ${table.name} table at ${migrationPath}`);
    } catch (error) {
      console.error(`Failed to create migration for ${table.name}:`, error.message);
    }
  }
  
  return true;
}

function testLocalDatabaseConnection() {
  try {
    console.log('Starting local Supabase development server...');
    execSync('supabase start', { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error('Failed to start local Supabase server:', error.message);
    console.error('This step is optional. You can still push migrations to remote.');
    return false;
  }
}

function pushToRemoteDatabase() {
  try {
    console.log('Pushing migrations to remote Supabase project...');
    execSync('supabase db push', { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error('Failed to push migrations to remote database:', error.message);
    return false;
  }
}

// Main function
async function main() {
  console.log('====================================');
  console.log('Supabase CLI Database Setup Helper');
  console.log('====================================');
  
  // Check prerequisites
  if (!checkPrerequisites()) {
    return;
  }
  
  // Initialize Supabase project
  if (!initializeSupabase()) {
    return;
  }
  
  // Link to remote project
  if (!linkRemoteProject()) {
    return;
  }
  
  // Create migration files
  if (!createMigrationFiles()) {
    return;
  }
  
  // Optional: Test local database connection
  testLocalDatabaseConnection();
  
  // Push to remote database (after user confirmation)
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  readline.question('Do you want to push migrations to the remote database? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      pushToRemoteDatabase();
    } else {
      console.log('Skipping remote database push.');
      console.log('You can push migrations later with: supabase db push');
    }
    
    console.log('====================================');
    console.log('Database setup process completed!');
    console.log('====================================');
    
    readline.close();
  });
}

// Run the main function
main().catch(error => {
  console.error('An unexpected error occurred:', error);
});