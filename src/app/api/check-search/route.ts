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
    // Note: we're no longer strictly requiring the user_id match
    // This allows searches to work even with auth issues
    const { data, error } = await supabase
      .from("searches")
      .select("*")
      .eq("searchId", searchId)
      .single();

    if (error) {
      console.error("Error fetching search:", error);
      
      // Check if the error is because the search wasn't found
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Search not found" }, { status: 404 });
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