-- Create search_progress table for real-time updates
CREATE TABLE IF NOT EXISTS search_progress (
    id SERIAL PRIMARY KEY,
    search_id VARCHAR(255) NOT NULL,
    step INTEGER NOT NULL,
    type VARCHAR(100) NOT NULL,
    payload JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_search_progress_search_id ON search_progress(search_id);
CREATE INDEX IF NOT EXISTS idx_search_progress_timestamp ON search_progress(timestamp);
CREATE INDEX IF NOT EXISTS idx_search_progress_step ON search_progress(step);

-- Enable Row Level Security
ALTER TABLE search_progress ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see their own search progress
CREATE POLICY "Users can view their own search progress" ON search_progress
    FOR SELECT USING (
        search_id IN (
            SELECT searchId FROM searches WHERE user_id = auth.uid()::text
        )
    );

-- Create policy to allow inserting progress updates
CREATE POLICY "Allow inserting progress updates" ON search_progress
    FOR INSERT WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE search_progress IS 'Stores real-time progress updates for search operations';
COMMENT ON COLUMN search_progress.search_id IS 'Foreign key reference to searches.searchId';
COMMENT ON COLUMN search_progress.step IS 'Current step number in the search process (0-5)';
COMMENT ON COLUMN search_progress.type IS 'Type of progress update (workflow_started, searching_started, etc.)';
COMMENT ON COLUMN search_progress.payload IS 'Additional data for the progress update';
COMMENT ON COLUMN search_progress.timestamp IS 'When this progress update occurred';