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