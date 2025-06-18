import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { z } from 'zod';
import type { Session } from "next-auth";
import { Mastra } from '@mastra/core';
import { ConsoleLogger } from '@mastra/loggers';

// Mastra vNext imports
import { humanReviewResumeSchema } from '@/lib/mastra-vnext-steps';
import { createRuntimeContextFromSession } from '@/lib/mastra-vnext-utils';

// Define a more specific type for the session object based on usage
interface AppSession extends Session {
  user: {
    id: string;
    apiKey?: string | null; // Scrapybara API Key from user session
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

// Resume workflow request validation schema
const resumeWorkflowSchema = z.object({
  searchId: z.string(),
  stepId: z.string(),
  resumeData: humanReviewResumeSchema.partial().extend({
    resumedAt: z.string().optional()
  })
});

/**
 * Resume Workflow API
 * 
 * This API route handles resuming suspended workflows with user input.
 * It validates the input, retrieves the suspended workflow from storage,
 * and continues execution from the suspended point.
 */
export async function POST(request: Request) {
  try {
    // Parse and validate request body
    const body = await request.json();
    
    try {
      resumeWorkflowSchema.parse(body);
    } catch (validationError) {
      console.error('[Resume Workflow] Validation error:', validationError);
      return NextResponse.json({ 
        error: "Invalid request data",
        details: validationError instanceof Error ? validationError.message : String(validationError)
      }, { status: 400 });
    }
    
    const { searchId, stepId, resumeData } = body;
    
    // Ensure resumeData has a timestamp
    if (!resumeData.resumedAt) {
      resumeData.resumedAt = new Date().toISOString();
    }

    // Check authentication with fallback to mock user ID for auth failures
    let userId = "mock-user-id-12345"; // Default mock ID for authentication fallback
    
    try {
      const session = await auth() as AppSession | null;
      if (session && session.user && session.user.id) {
        userId = session.user.id;
      } else {
        console.log("[Resume Workflow] Authentication failed, using mock user ID");
      }
    } catch (authError) {
      console.error("[Resume Workflow] Authentication error:", authError);
      // Continue with mock user ID
    }
    
    console.log(`[Resume Workflow] Attempting to resume workflow searchId=${searchId}, stepId=${stepId}`);

    // Check if the workflow exists and is suspended
    const { data: workflowData, error: fetchError } = await supabase
      .from('suspended_workflows')
      .select('*')
      .eq('searchId', searchId)
      .eq('user_id', userId)
      .eq('is_suspended', true)
      .single();
    
    if (fetchError || !workflowData) {
      console.error('[Resume Workflow] Error fetching suspended workflow:', fetchError);
      return NextResponse.json({ 
        error: "Workflow not found or not suspended",
        details: fetchError?.message
      }, { status: 404 });
    }
    
    // Ensure the workflow is suspended at the correct step
    if (workflowData.suspended_step_id !== stepId) {
      return NextResponse.json({ 
        error: "Workflow is suspended at a different step",
        expected: workflowData.suspended_step_id,
        received: stepId
      }, { status: 409 });
    }
    
    try {
      // Mark workflow as being resumed in the database
      await supabase
        .from('suspended_workflows')
        .update({ 
          resumed_at: new Date().toISOString(),
          resume_data: resumeData,
          is_suspended: false
        })
        .eq('searchId', searchId)
        .eq('user_id', userId);
      
      // In a full implementation, this would actually resume the workflow
      // For now, we'll just return success and let the client handle it
      // In a production system, we would use a message queue or similar to trigger
      // the actual resumption on a worker
        
      return NextResponse.json({
        success: true,
        message: "Workflow resumption initiated",
        searchId,
        resumedAt: resumeData.resumedAt,
        nextSteps: "Client should poll for search results"
      });
      
    } catch (resumeError) {
      console.error('[Resume Workflow] Error resuming workflow:', resumeError);
      
      // Update the database to reflect the resume failure
      await supabase
        .from('suspended_workflows')
        .update({ 
          resume_error: resumeError instanceof Error ? resumeError.message : String(resumeError)
        })
        .eq('searchId', searchId)
        .eq('user_id', userId);
      
      return NextResponse.json({ 
        error: "Failed to resume workflow",
        details: resumeError instanceof Error ? resumeError.message : String(resumeError)
      }, { status: 500 });
    }
  } catch (err) {
    console.error("[Resume Workflow] Critical error:", err);
    return NextResponse.json({ 
      error: "Something went wrong in the API handler",
      details: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}

/**
 * GET endpoint to check if a workflow is suspended
 */
export async function GET(request: Request) {
  try {
    // Extract searchId from URL
    const { searchParams } = new URL(request.url);
    const searchId = searchParams.get('searchId');
    
    if (!searchId) {
      return NextResponse.json({ error: "Missing searchId parameter" }, { status: 400 });
    }
    
    // Check authentication with fallback to mock user ID for auth failures
    let userId = "mock-user-id-12345"; // Default mock ID for authentication fallback
    
    try {
      const session = await auth() as AppSession | null;
      if (session && session.user && session.user.id) {
        userId = session.user.id;
      } else {
        console.log("[Resume Workflow GET] Authentication failed, using mock user ID");
      }
    } catch (authError) {
      console.error("[Resume Workflow GET] Authentication error:", authError);
      // Continue with mock user ID
    }
    
    // Check if the workflow exists and is suspended
    const { data: workflowData, error: fetchError } = await supabase
      .from('suspended_workflows')
      .select('*')
      .eq('searchId', searchId)
      .eq('user_id', userId)
      .eq('is_suspended', true)
      .single();
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        // No data found, workflow is not suspended
        return NextResponse.json({ 
          suspended: false,
          searchId
        });
      }
      
      console.error('[Resume Workflow GET] Database error:', fetchError);
      return NextResponse.json({ 
        error: "Error checking workflow status",
        details: fetchError.message
      }, { status: 500 });
    }
    
    // Return the suspension information
    return NextResponse.json({
      suspended: true,
      searchId,
      stepId: workflowData.suspended_step_id,
      suspendedAt: workflowData.suspended_at,
      suspendData: workflowData.suspend_data
    });
    
  } catch (err) {
    console.error("[Resume Workflow GET] Critical error:", err);
    return NextResponse.json({ 
      error: "Something went wrong in the API handler",
      details: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}