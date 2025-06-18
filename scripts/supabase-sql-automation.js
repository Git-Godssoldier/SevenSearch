
// This script automates the execution of SQL in Supabase SQL Editor using Puppeteer
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration
const SUPABASE_URL = 'https://nxohsklmwjzfqvqjouis.supabase.co';
const SQL_CHUNKS = [
  "-- Statement 1 of 38\n-- Combined SQL script to create all required tables for the application\n\n-- 1. Create users table\nCREATE TABLE IF NOT EXISTS public.users (\n  id UUID PRIMARY KEY,\n  full_name TEXT,\n  email TEXT UNIQUE,\n  api_key TEXT,\n  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),\n  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()\n);\n\n-- Statement 2 of 38\n-- Enable Row Level Security for users\nALTER TABLE users ENABLE ROW LEVEL SECURITY;\n\n-- Statement 3 of 38\n-- Create policy to allow users to access their own data\nCREATE POLICY user_policy ON users\n  FOR ALL\n  TO authenticated\n  USING (id = auth.uid());\n\n-- Statement 4 of 38\n-- Create trigger to update the updated_at timestamp\nCREATE OR REPLACE FUNCTION update_user_timestamp()\nRETURNS TRIGGER AS $$\nBEGIN\n  NEW.updated_at = NOW();\n\n-- Statement 5 of 38\nRETURN NEW;\n\n-- Statement 6 of 38\nEND;\n\n-- Statement 7 of 38\n$$ LANGUAGE plpgsql;\n\n-- Statement 8 of 38\nCREATE TRIGGER update_user_timestamp\nBEFORE UPDATE ON users\nFOR EACH ROW\nEXECUTE FUNCTION update_user_timestamp();\n\n-- Statement 9 of 38\n-- 2. Create searches table\nCREATE TABLE IF NOT EXISTS searches (\n  id SERIAL PRIMARY KEY,\n  searchId TEXT NOT NULL UNIQUE,\n  user_id TEXT NOT NULL,\n  query TEXT NOT NULL,\n  enhanced_query TEXT,\n  sources TEXT,\n  summary TEXT,\n  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),\n  completed_at TIMESTAMP WITH TIME ZONE,\n  completed BOOLEAN DEFAULT FALSE,\n  search_approach TEXT\n);\n\n-- Statement 10 of 38\nCREATE INDEX IF NOT EXISTS idx_searches_searchid ON searches(searchId);\n\n-- Statement 11 of 38\nCREATE INDEX IF NOT EXISTS idx_searches_user_id ON searches(user_id);\n\n-- Statement 12 of 38\nCREATE INDEX IF NOT EXISTS idx_searches_completed ON searches(completed);\n\n-- Statement 13 of 38\n-- Enable Row Level Security for searches\nALTER TABLE searches ENABLE ROW LEVEL SECURITY;\n\n-- Statement 14 of 38\n-- Create policy for searches\nCREATE POLICY user_search_policy ON searches\n  FOR ALL\n  TO authenticated\n  USING (user_id = auth.uid());\n\n-- Statement 15 of 38\n-- 3. Create suspended_workflows table\nCREATE TABLE IF NOT EXISTS suspended_workflows (\n  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  searchId TEXT NOT NULL,\n  user_id TEXT NOT NULL,\n  suspended_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),\n  resumed_at TIMESTAMP WITH TIME ZONE,\n  suspended_step_id TEXT NOT NULL,\n  suspend_data JSONB NOT NULL DEFAULT '{}'::jsonb,\n  resume_data JSONB,\n  workflow_state JSONB,\n  is_suspended BOOLEAN NOT NULL DEFAULT TRUE,\n  resume_error TEXT,\n  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),\n  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()\n);\n\n-- Statement 16 of 38\n-- Add indexes for common queries\nCREATE INDEX IF NOT EXISTS suspended_workflows_searchid_idx ON suspended_workflows(searchId);\n\n-- Statement 17 of 38\nCREATE INDEX IF NOT EXISTS suspended_workflows_userid_idx ON suspended_workflows(user_id);\n\n-- Statement 18 of 38\nCREATE INDEX IF NOT EXISTS suspended_workflows_suspended_idx ON suspended_workflows(is_suspended);\n\n-- Statement 19 of 38\n-- Add combination index for the most common lookup pattern\nCREATE INDEX IF NOT EXISTS suspended_workflows_search_user_suspended_idx\nON suspended_workflows(searchId, user_id, is_suspended);\n\n-- Statement 20 of 38\n-- Add trigger to update updated_at timestamp\nCREATE OR REPLACE FUNCTION update_suspended_workflow_timestamp()\nRETURNS TRIGGER AS $$\nBEGIN\n  NEW.updated_at = NOW();\n\n-- Statement 21 of 38\nRETURN NEW;\n\n-- Statement 22 of 38\nEND;\n\n-- Statement 23 of 38\n$$ LANGUAGE plpgsql;\n\n-- Statement 24 of 38\nCREATE TRIGGER update_suspended_workflow_timestamp\nBEFORE UPDATE ON suspended_workflows\nFOR EACH ROW\nEXECUTE FUNCTION update_suspended_workflow_timestamp();\n\n-- Statement 25 of 38\n-- Enable Row Level Security for suspended_workflows\nALTER TABLE suspended_workflows ENABLE ROW LEVEL SECURITY;\n\n-- Statement 26 of 38\n-- Create policy for suspended_workflows\nCREATE POLICY user_suspended_workflow_policy ON suspended_workflows\n  FOR ALL\n  TO authenticated\n  USING (user_id = auth.uid());\n\n-- Statement 27 of 38\n-- 4. Create tasks table\nCREATE TABLE IF NOT EXISTS tasks (\n  id TEXT PRIMARY KEY,\n  searchId TEXT NOT NULL,\n  userId TEXT NOT NULL,\n  title TEXT NOT NULL,\n  description TEXT,\n  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),\n  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'cancelled')),\n  depends_on JSONB DEFAULT '[]'::jsonb,\n  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),\n  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),\n  completed_at TIMESTAMP WITH TIME ZONE,\n  tags JSONB DEFAULT '[]'::jsonb,\n  metadata JSONB DEFAULT '{}'::jsonb\n);\n\n-- Statement 28 of 38\n-- Optimized indexing for efficient memory access\nCREATE INDEX IF NOT EXISTS tasks_searchid_idx ON tasks(searchId);\n\n-- Statement 29 of 38\nCREATE INDEX IF NOT EXISTS tasks_userid_idx ON tasks(userId);\n\n-- Statement 30 of 38\nCREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);\n\n-- Statement 31 of 38\nCREATE INDEX IF NOT EXISTS tasks_priority_idx ON tasks(priority);\n\n-- Statement 32 of 38\n-- Enable Row Level Security for tasks\nALTER TABLE tasks ENABLE ROW LEVEL SECURITY;\n\n-- Statement 33 of 38\n-- Create policy for tasks\nCREATE POLICY user_tasks_policy ON tasks\n  FOR ALL\n  TO authenticated\n  USING (userId = auth.uid());\n\n-- Statement 34 of 38\n-- 5. Create workflow_planning table\nCREATE TABLE IF NOT EXISTS workflow_planning (\n  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  searchId TEXT NOT NULL,\n  userId TEXT NOT NULL,\n  planning_stage TEXT NOT NULL CHECK (planning_stage IN (\n    'initial', \n    'requirements_analysis', \n    'task_decomposition', \n    'strategy_formulation', \n    'resource_allocation', \n    'ready'\n  )),\n  planning_result JSONB DEFAULT '{}'::jsonb,\n  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),\n  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()\n);\n\n-- Statement 35 of 38\n-- Optimized access patterns for planning retrieval\nCREATE INDEX IF NOT EXISTS workflow_planning_searchid_idx ON workflow_planning(searchId);\n\n-- Statement 36 of 38\nCREATE INDEX IF NOT EXISTS workflow_planning_userid_idx ON workflow_planning(userId);\n\n-- Statement 37 of 38\n-- Enable Row Level Security for workflow_planning\nALTER TABLE workflow_planning ENABLE ROW LEVEL SECURITY;\n\n-- Statement 38 of 38\n-- Create policy for workflow_planning\nCREATE POLICY user_workflow_planning_policy ON workflow_planning\n  FOR ALL\n  TO authenticated\n  USING (userId = auth.uid());"
];

async function runSql() {
  console.log('Starting Supabase SQL automation with Puppeteer');
  
  // Launch a new browser instance
  const browser = await puppeteer.launch({
    headless: false, // Set to true for headless operation
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to Supabase
    console.log('Navigating to Supabase...');
    await page.goto(SUPABASE_URL);
    
    // Wait for user to log in manually
    console.log('⚠️ Please log in to Supabase manually when the browser opens');
    
    // Wait for dashboard to load after login
    await page.waitForSelector('.supabase-dashboard', { timeout: 300000 });
    console.log('Dashboard loaded. Navigating to SQL Editor...');
    
    // Navigate to SQL Editor
    await page.evaluate(() => {
      // Look for SQL Editor in the sidebar
      const sidebarItems = Array.from(document.querySelectorAll('a, button'));
      const sqlEditorLink = sidebarItems.find(item => 
        item.textContent.toLowerCase().includes('sql') || 
        item.textContent.toLowerCase().includes('editor')
      );
      
      if (sqlEditorLink) sqlEditorLink.click();
    });
    
    // Wait for SQL Editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 60000 });
    console.log('SQL Editor loaded.');
    
    // Execute each SQL chunk
    for (let i = 0; i < SQL_CHUNKS.length; i++) {
      console.log(`Executing SQL chunk ${i + 1} of ${SQL_CHUNKS.length}...`);
      
      // Clear existing SQL and insert new chunk
      await page.evaluate(() => {
        // Find the Monaco editor instance
        const editor = document.querySelector('.monaco-editor');
        if (editor) {
          // Clear editor using browser APIs
          const clearButton = Array.from(document.querySelectorAll('button'))
            .find(btn => btn.textContent.toLowerCase().includes('clear'));
          
          if (clearButton) clearButton.click();
        }
      });
      
      // Type the SQL
      await page.type('.monaco-editor textarea', SQL_CHUNKS[i]);
      
      // Click the Run button
      await page.evaluate(() => {
        const runButton = Array.from(document.querySelectorAll('button'))
          .find(btn => 
            btn.textContent.toLowerCase().includes('run') || 
            btn.getAttribute('aria-label')?.toLowerCase().includes('run')
          );
        
        if (runButton) runButton.click();
      });
      
      // Wait for execution to complete
      console.log('Waiting for SQL execution to complete...');
      await page.waitForTimeout(5000); // Basic wait time
      
      // Check for error messages
      const hasError = await page.evaluate(() => {
        return !!document.querySelector('.error-message') || 
               !!document.querySelector('[data-test="error-message"]');
      });
      
      if (hasError) {
        console.log('⚠️ Warning: Possible error detected in SQL execution');
        // Continue anyway
      } else {
        console.log('SQL chunk executed successfully');
      }
      
      // Wait a moment before next statement
      await page.waitForTimeout(2000);
    }
    
    console.log('All SQL chunks executed! 🎉');
    
    // Keep the browser open for manual inspection
    console.log('Browser will remain open for you to verify the results.');
    console.log('Close the browser manually when finished.');
    
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

// Run the automation
runSql();
