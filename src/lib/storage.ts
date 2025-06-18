import { supabase } from "@/lib/supabase";

interface Search {
  id: string
  query: string
  created_at: Date
  user_id?: string
}

// In-memory fallback storage
const searches: Record<string, Search> = {}

// Enhanced createSearch with user ID support
export async function createSearch(
  searchId: string, 
  query: string, 
  userId: string = "mock-user-id-12345"
): Promise<Search> {
  const timestamp = new Date();
  
  // Create search object
  const search = {
    id: searchId,
    query,
    created_at: timestamp,
    user_id: userId
  }
  
  // Try to store in Supabase if available
  try {
    // First check if the searches table exists
    const { error: tableCheckError } = await supabase
      .from('searches')
      .select('*')
      .limit(1)
      .throwOnError();
    
    // If table exists (no error), try to insert
    if (!tableCheckError) {
      const { error } = await supabase
        .from('searches')
        .insert({
          searchId,
          query,
          user_id: userId,
          created_at: timestamp.toISOString()
        });
        
      if (error) {
        console.error("Failed to insert search into Supabase:", error);
      }
    }
  } catch (dbError) {
    console.error("Database error in createSearch:", dbError);
  }
  
  // Always store in memory as fallback
  searches[searchId] = search
  return search
}

export async function getSearchById(searchId: string, userId: string) {
  try {
    // Check if either parameter is undefined before querying
    if (!searchId || !userId) {
      return null;
    }

    const { data, error } = await supabase
      .from("searches")
      .select("*")
      .eq("searchId", searchId)
      .eq("user_id", userId)
      .single();
    
    if (error) {
      // For "not found" errors, return null without raising alarm
      if (error.code === "PGRST116") {
        return null;
      }
      
      // For other errors, log with more detail
      console.error("Unexpected database error:", error.message, error.details);
      return null;
    }
    return data;
  } catch (err) {
    // This catches more serious errors like network issues
    console.error("Exception in getSearchById:", err);
    return null;
  }
}

export async function getAllSearches(): Promise<Search[]> {
  return Object.values(searches).sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
}

