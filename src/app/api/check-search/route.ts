// src/app/api/check-search/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { auth } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    // Extract the search ID from the URL search parameters
    const { searchParams } = new URL(request.url);
    const searchId = searchParams.get('id');
    
    if (!searchId) {
      return NextResponse.json({ error: "Search ID is required" }, { status: 400 });
    }

    // Try to get the user ID from the session
    let user_id = "mock-user-id-12345"; // Default mock ID if authentication fails
    
    try {
      const session = await auth();
      if (session && session.user && session.user.id) {
        user_id = session.user.id;
      } else {
        console.log("No valid session, using mock user ID");
      }
    } catch (authError) {
      console.error("Auth error:", authError);
      // Continue with mock user ID
    }

    // Query the database for the search with the given ID
    // First try with user_id match, then fallback to any match
    let { data, error } = await supabase
      .from("searches")
      .select("*")
      .eq("searchId", searchId)
      .eq("user_id", user_id)
      .single();

    // If not found with user match, try without user restriction
    if (error && error.code === "PGRST116") {
      const fallbackResult = await supabase
        .from("searches")
        .select("*")
        .eq("searchId", searchId)
        .single();

      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      console.error("Error fetching search:", error);

      // Check if the error is because the search wasn't found
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Search not found" }, { status: 404 });
      }

      // Check if the error is because the table doesn't exist
      if (error.code === "42P01") {
        console.log("Searches table does not exist, returning mock response");
        return NextResponse.json({
          searchId,
          query: "Test query (table not found)",
          summary: "The searches table does not exist in the database. Please create it using the SQL provided in the setup instructions.",
          completed: true,
          created_at: new Date().toISOString(),
          search_approach: 'mock_response'
        });
      }

      return NextResponse.json({ error: "Failed to fetch search data" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Search not found" }, { status: 404 });
    }

    // Return the search data
    return NextResponse.json(data);
  } catch (err) {
    console.error("Failed to check search:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}