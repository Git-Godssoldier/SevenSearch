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