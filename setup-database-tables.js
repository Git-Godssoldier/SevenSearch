#!/usr/bin/env node

/**
 * Setup database tables using Supabase REST API
 * This script creates the required tables for the search application
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Check for required environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nPlease check your .env.local file.');
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Execute SQL using Supabase REST API
 */
async function executeSQL(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY
    },
    body: JSON.stringify({ sql })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SQL execution failed: ${response.status} - ${error}`);
  }

  return await response.json();
}

/**
 * Check if a table exists
 */
async function tableExists(tableName) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?select=*&limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY
      }
    });
    
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Create the searches table directly
 */
async function createSearchesTable() {
  const sql = `
    -- Create searches table
    CREATE TABLE IF NOT EXISTS searches (
      id SERIAL PRIMARY KEY,
      searchId TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      query TEXT NOT NULL,
      enhanced_query TEXT,
      sources TEXT,
      summary TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      completed_at TIMESTAMP WITH TIME ZONE,
      completed BOOLEAN DEFAULT FALSE,
      search_approach TEXT
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_searches_searchid ON searches(searchId);
    CREATE INDEX IF NOT EXISTS idx_searches_user_id ON searches(user_id);
    CREATE INDEX IF NOT EXISTS idx_searches_completed ON searches(completed);
  `;

  try {
    console.log('🔧 Creating searches table...');
    await executeSQL(sql);
    console.log('✅ Searches table created successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to create searches table:', error.message);
    return false;
  }
}

/**
 * Alternative approach: Create table using direct SQL execution
 */
async function createTableDirectly() {
  const { createClient } = require('@supabase/supabase-js');
  
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const sql = `
    CREATE TABLE IF NOT EXISTS searches (
      id SERIAL PRIMARY KEY,
      searchId TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      query TEXT NOT NULL,
      enhanced_query TEXT,
      sources TEXT,
      summary TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      completed_at TIMESTAMP WITH TIME ZONE,
      completed BOOLEAN DEFAULT FALSE,
      search_approach TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_searches_searchid ON searches(searchId);
    CREATE INDEX IF NOT EXISTS idx_searches_user_id ON searches(user_id);
    CREATE INDEX IF NOT EXISTS idx_searches_completed ON searches(completed);
  `;

  try {
    console.log('🔧 Creating searches table using direct SQL...');
    
    // Split SQL into individual statements
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement.trim() + ';' });
        if (error) {
          console.error(`❌ Error executing statement: ${error.message}`);
          console.log(`Statement: ${statement.trim()}`);
        } else {
          console.log(`✅ Executed: ${statement.trim().substring(0, 50)}...`);
        }
      }
    }
    
    console.log('✅ Database setup completed');
    return true;
  } catch (error) {
    console.error('❌ Failed to setup database:', error.message);
    return false;
  }
}

/**
 * Simple approach: Just create the table using basic SQL
 */
async function simpleTableCreation() {
  const { createClient } = require('@supabase/supabase-js');
  
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    console.log('🔧 Creating searches table...');
    
    // Try to insert a test record to see if table exists
    const { error: testError } = await supabase
      .from('searches')
      .select('id')
      .limit(1);

    if (testError && testError.message.includes('does not exist')) {
      console.log('📋 Table does not exist, creating it...');
      
      // Create table using raw SQL
      const createTableSQL = `
        CREATE TABLE searches (
          id SERIAL PRIMARY KEY,
          searchId TEXT NOT NULL UNIQUE,
          user_id TEXT NOT NULL,
          query TEXT NOT NULL,
          enhanced_query TEXT,
          sources TEXT,
          summary TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          completed_at TIMESTAMP WITH TIME ZONE,
          completed BOOLEAN DEFAULT FALSE,
          search_approach TEXT
        );
      `;

      // Use a simple HTTP request to execute SQL
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY
        },
        body: JSON.stringify({ sql: createTableSQL })
      });

      if (response.ok) {
        console.log('✅ Searches table created successfully');
        
        // Create indexes
        const indexSQL = `
          CREATE INDEX IF NOT EXISTS idx_searches_searchid ON searches(searchId);
          CREATE INDEX IF NOT EXISTS idx_searches_user_id ON searches(user_id);
          CREATE INDEX IF NOT EXISTS idx_searches_completed ON searches(completed);
        `;
        
        const indexResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'apikey': SERVICE_ROLE_KEY
          },
          body: JSON.stringify({ sql: indexSQL })
        });

        if (indexResponse.ok) {
          console.log('✅ Indexes created successfully');
        }
        
        return true;
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to create table:', errorText);
        return false;
      }
    } else {
      console.log('✅ Searches table already exists');
      return true;
    }
  } catch (error) {
    console.error('❌ Error during table creation:', error.message);
    return false;
  }
}

/**
 * Main setup function
 */
async function setupDatabase() {
  console.log('🚀 Setting up database tables...\n');
  
  try {
    // Check if searches table exists
    const exists = await tableExists('searches');
    
    if (exists) {
      console.log('✅ Searches table already exists');
      return true;
    }

    console.log('📋 Searches table does not exist, creating...');
    
    // Try simple table creation
    const success = await simpleTableCreation();
    
    if (success) {
      console.log('\n🎉 Database setup completed successfully!');
      return true;
    } else {
      console.log('\n❌ Database setup failed');
      return false;
    }
    
  } catch (error) {
    console.error('\n💥 Database setup failed with error:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Check your Supabase URL and service role key');
    console.log('2. Ensure your Supabase project is active');
    console.log('3. Verify network connectivity to Supabase');
    return false;
  }
}

// Run the setup
setupDatabase().then(success => {
  process.exit(success ? 0 : 1);
});
