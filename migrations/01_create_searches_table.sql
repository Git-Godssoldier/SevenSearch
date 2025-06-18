-- Create the searches table if it doesn't exist
CREATE TABLE IF NOT EXISTS searches (
  id SERIAL PRIMARY KEY,
  searchId TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  query TEXT NOT NULL,
  enhanced_query TEXT,
  sources TEXT, -- JSON string of source URLs
  summary TEXT, -- HTML summary content
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  completed BOOLEAN DEFAULT FALSE,
  search_approach TEXT -- 'traditional_search' or 'deep_search'
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_searches_searchid ON searches(searchId);
CREATE INDEX IF NOT EXISTS idx_searches_user_id ON searches(user_id);
CREATE INDEX IF NOT EXISTS idx_searches_completed ON searches(completed);

-- Grant privileges to authenticated users
ALTER TABLE searches ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to see only their own searches
CREATE POLICY user_search_policy ON searches
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());