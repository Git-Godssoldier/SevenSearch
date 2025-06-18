import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Use Edge Runtime for better performance
export const runtime = 'edge';

/**
 * Webhook endpoint for receiving search progress updates
 * Accepts POST requests with search progress data and broadcasts to clients
 */
export async function POST(request: Request) {
  try {
    const { searchId, step, type, payload, timestamp } = await request.json();

    if (!searchId) {
      return NextResponse.json({ error: "searchId is required" }, { status: 400 });
    }

    console.log(`[Webhook] Received progress update for search ${searchId}: ${type} (step ${step})`);

    // Store the progress update in database for persistence
    try {
      const { error } = await supabase
        .from('search_progress')
        .insert({
          search_id: searchId,
          step,
          type,
          payload: JSON.stringify(payload || {}),
          timestamp: timestamp || new Date().toISOString()
        });

      if (error) {
        console.error('[Webhook] Error storing progress:', error);
      }
    } catch (storageError) {
      console.error('[Webhook] Storage error:', storageError);
    }

    // Broadcast the update to connected clients via Server-Sent Events
    // This would typically use Redis Pub/Sub or similar for scaling
    // For now, we'll use Supabase real-time subscriptions
    
    return NextResponse.json({ 
      success: true, 
      message: "Progress update received",
      searchId,
      step,
      type
    });

  } catch (error) {
    console.error("[Webhook] Error processing request:", error);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}

/**
 * GET endpoint to retrieve current progress for a search
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const searchId = searchParams.get('searchId');

    if (!searchId) {
      return NextResponse.json({ error: "searchId parameter is required" }, { status: 400 });
    }

    // Get latest progress updates for the search
    const { data, error } = await supabase
      .from('search_progress')
      .select('*')
      .eq('search_id', searchId)
      .order('timestamp', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[Webhook] Error fetching progress:', error);
      return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
    }

    return NextResponse.json({
      searchId,
      progress: data || []
    });

  } catch (error) {
    console.error("[Webhook] Error in GET handler:", error);
    return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
  }
}