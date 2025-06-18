-- 4. Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  searchId TEXT NOT NULL,
  userId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'cancelled')),
  depends_on JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  tags JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Optimized indexing for efficient memory access
CREATE INDEX IF NOT EXISTS tasks_searchid_idx ON tasks(searchId);
CREATE INDEX IF NOT EXISTS tasks_userid_idx ON tasks(userId);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
CREATE INDEX IF NOT EXISTS tasks_priority_idx ON tasks(priority);

-- Enable Row Level Security for tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create policy for tasks
CREATE POLICY user_tasks_policy ON tasks
  FOR ALL
  TO authenticated
  USING (userId = auth.uid());