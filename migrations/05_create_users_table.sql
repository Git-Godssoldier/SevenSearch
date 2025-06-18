-- Create users table for authentication
CREATE TABLE IF NOT EXISTS public.users (
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

-- Create trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_timestamp
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_user_timestamp();