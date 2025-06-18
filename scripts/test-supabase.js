// Script to validate Supabase connection
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
];

// Check for missing environment variables
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  process.exit(1);
}

console.log('✅ All required environment variables are present');

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Key length:', supabaseServiceRoleKey.length);

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function testConnection() {
  try {
    // Check if connection works
    console.log('Testing connection to Supabase...');
    
    // Try to query the users table
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.code === 'PGRST116') {
        console.log('⚠️ Users table may not exist yet. This is okay if you haven\'t created it.');
        
        // Try listing all tables instead
        const { data: tables, error: tablesError } = await supabase
          .rpc('list_tables');
        
        if (tablesError) {
          console.error('❌ Error fetching tables:', tablesError);
        } else {
          console.log('✅ Available tables:', tables || 'None found');
        }
      } else {
        console.error('❌ Error fetching users:', error);
      }
    } else {
      console.log('✅ Successfully connected to Supabase');
      console.log('Users found:', data ? data.length : 0);
    }
  } catch (error) {
    console.error('❌ Exception when connecting to Supabase:', error);
  }
}

testConnection();