-- Migration to create the workflow_planning table for dynamic orchestration

-- Create workflow_planning table
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

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS workflow_planning_searchid_idx ON workflow_planning(searchId);
CREATE INDEX IF NOT EXISTS workflow_planning_userid_idx ON workflow_planning(userId);
CREATE INDEX IF NOT EXISTS workflow_planning_stage_idx ON workflow_planning(planning_stage);

-- Add combination index for the most common lookup pattern
CREATE INDEX IF NOT EXISTS workflow_planning_search_user_idx 
ON workflow_planning(searchId, userId);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_workflow_planning_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workflow_planning_timestamp
BEFORE UPDATE ON workflow_planning
FOR EACH ROW
EXECUTE FUNCTION update_workflow_planning_timestamp();