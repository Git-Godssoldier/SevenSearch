// Script to check if the users table exists in Supabase
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkUsersTable() {
  try {
    console.log('Attempting to query the users table...');
    
    // Try to query the users table
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.message.includes('does not exist')) {
        console.error('❌ The users table does not exist. This is needed for authentication to work.');
        console.log('\nYou need to create the users table manually in Supabase with:');
        console.log(`
CREATE TABLE public.users (
  id UUID PRIMARY KEY,
  full_name TEXT,
  email TEXT UNIQUE,
  api_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to access their own data
CREATE POLICY user_policy ON users
  FOR ALL
  TO authenticated
  USING (id = auth.uid());
        `);
      } else {
        console.error('❌ Error querying users table:', error);
      }
    } else {
      console.log('✅ The users table exists!');
      console.log('Sample data:', data);
    }
  } catch (error) {
    console.error('❌ Exception when connecting to Supabase:', error);
  }
}

checkUsersTable();