-- Migration to create the tasks table for workflow task management

-- Create tasks table
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

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS tasks_searchid_idx ON tasks(searchId);
CREATE INDEX IF NOT EXISTS tasks_userid_idx ON tasks(userId);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
CREATE INDEX IF NOT EXISTS tasks_priority_idx ON tasks(priority);

-- Add combination index for the most common lookup pattern
CREATE INDEX IF NOT EXISTS tasks_search_user_status_idx 
ON tasks(searchId, userId, status);

-- Add GIN index for searching tags
CREATE INDEX IF NOT EXISTS tasks_tags_idx ON tasks USING GIN (tags);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_task_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_task_timestamp
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_task_timestamp();