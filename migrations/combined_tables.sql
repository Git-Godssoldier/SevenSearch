-- Combined SQL script to create all required tables for the application

-- 1. Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  full_name TEXT,
  email TEXT UNIQUE,
  api_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security for users
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

-- 3. Create suspended_workflows table
CREATE TABLE IF NOT EXISTS suspended_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  searchId TEXT NOT NULL,
  user_id TEXT NOT NULL,
  suspended_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  resumed_at TIMESTAMP WITH TIME ZONE,
  suspended_step_id TEXT NOT NULL,
  suspend_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  resume_data JSONB,
  workflow_state JSONB,
  is_suspended BOOLEAN NOT NULL DEFAULT TRUE,
  resume_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS suspended_workflows_searchid_idx ON suspended_workflows(searchId);
CREATE INDEX IF NOT EXISTS suspended_workflows_userid_idx ON suspended_workflows(user_id);
CREATE INDEX IF NOT EXISTS suspended_workflows_suspended_idx ON suspended_workflows(is_suspended);

-- Add combination index for the most common lookup pattern
CREATE INDEX IF NOT EXISTS suspended_workflows_search_user_suspended_idx
ON suspended_workflows(searchId, user_id, is_suspended);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_suspended_workflow_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_suspended_workflow_timestamp
BEFORE UPDATE ON suspended_workflows
FOR EACH ROW
EXECUTE FUNCTION update_suspended_workflow_timestamp();

-- Enable Row Level Security for suspended_workflows
ALTER TABLE suspended_workflows ENABLE ROW LEVEL SECURITY;

-- Create policy for suspended_workflows
CREATE POLICY user_suspended_workflow_policy ON suspended_workflows
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

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

-- 5. Create workflow_planning table
CREATE TABLE IF NOT EXISTS workflow_planning (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  searchId TEXT NOT NULL,
  userId TEXT NOT NULL,
  planning_stage TEXT NOT NULL CHECK (planning_stage IN (
    'initial', 
    'requirements_analysis', 
    'task_decomposition', 
    'strategy_formulation', 
    'resource_allocation', 
    'ready'
  )),
  planning_result JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Optimized access patterns for planning retrieval
CREATE INDEX IF NOT EXISTS workflow_planning_searchid_idx ON workflow_planning(searchId);
CREATE INDEX IF NOT EXISTS workflow_planning_userid_idx ON workflow_planning(userId);

-- Enable Row Level Security for workflow_planning
ALTER TABLE workflow_planning ENABLE ROW LEVEL SECURITY;

-- Create policy for workflow_planning
CREATE POLICY user_workflow_planning_policy ON workflow_planning
  FOR ALL
  TO authenticated
  USING (userId = auth.uid());