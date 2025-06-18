-- 2. Create searches table
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

-- Enable Row Level Security for searches
ALTER TABLE searches ENABLE ROW LEVEL SECURITY;

-- Create policy for searches
CREATE POLICY user_search_policy ON searches
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());