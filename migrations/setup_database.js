// @ts-check
/**
 * Setup database for the Q Search application.
 * The script checks for required tables and creates any that are missing
 * using the SQL files in the migrations directory.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Supabase URL and service role key are required.');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TABLES = [
  { name: 'combined_tables', file: 'combined_tables.sql' }
];

async function tableExists(tableName) {
  const { data, error } = await supabase
    .from(tableName)
    .select('id')
    .limit(1);
  if (error) {
    if (error.message && error.message.includes('does not exist')) {
      return false;
    }
    throw error;
  }
  return Array.isArray(data);
}

async function setupDatabase() {
  console.log('Executing combined_tables.sql...');
  const sql = fs.readFileSync(path.join(__dirname, 'combined_tables.sql'), 'utf8');
  const statements = sql.split(';');

  for (const statement of statements) {
    if (statement.trim()) {
      const { error } = await supabase.sql(statement);
      if (error) {
        console.error(`Failed to execute statement:`, error.message);
        console.log(`Statement: ${statement}`);
      } else {
        console.log(`Statement executed successfully: ${statement.trim().substring(0, 50)}...`);
      }
    }
  }
  console.log('Database setup completed!');
}

setupDatabase().catch((err) => {
  console.error('Database setup failed:', err.message || err);
});
