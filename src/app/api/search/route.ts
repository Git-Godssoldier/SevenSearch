import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { getAuthenticatedUserId } from "@/lib/utils/api-helpers";
import { workingSearchProvider } from "@/lib/search-providers/working-search-implementation";
import { performanceMonitor } from "@/lib/monitoring/performance-monitor";

// Use Node.js runtime for auth compatibility  
// TODO: Convert to Edge Runtime once auth is removed
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { query, category } = await request.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Determine user ID using auth helper with bypass support
    let user_id: string;
    try {
      user_id = await getAuthenticatedUserId();
    } catch (authError) {
      console.error("Auth error:", authError);
      user_id = "mock-user-id-12345";
    }

    console.log(`[Search API] Starting HALO search for query: "${query}", category: ${category}`);

    try {
      // Use working search provider with actual API integration
      const searchResult = await workingSearchProvider.executeSearch(query);

      // Store search in database
      const searchId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        const { data, error } = await supabase
          .from('searches')
          .insert({
            searchId,
            user_id,
            query,
            enhanced_query: query, // Will be enhanced by HALO in future
            sources: JSON.stringify(searchResult.results.map(r => r.url)),
            summary: `Found ${searchResult.results.length} results with ${(searchResult.validation.score * 100).toFixed(1)}% quality score`,
            completed: true,
            completed_at: new Date().toISOString(),
            search_approach: 'halo_orchestrated'
          });

        if (error) {
          console.error('[Search API] Error storing search in Supabase:', error);
        }
      } catch (storageError) {
        console.error('[Search API] Error storing search results:', storageError);
      }

      return NextResponse.json({
        results: searchResult.results,
        metrics: searchResult.metrics,
        validation: searchResult.validation,
        searchId,
        recommendations: searchResult.validation.recommendations
      });

    } catch (searchError) {
      console.error("[Search API] Working search provider error:", searchError);
      
      // Fallback to mock results if HALO fails
      const mockResults = [
        {
          id: `mock_${Date.now()}`,
          title: `Search results for "${query}"`,
          content: `This is a mock result for the query "${query}". The search system is currently in development mode.`,
          url: "https://example.com/mock-result",
          source: "mock",
          relevanceScore: 0.8,
          credibilityScore: 0.7,
          freshnessScore: 0.9,
          timestamp: new Date().toISOString()
        }
      ];

      return NextResponse.json({
        results: mockResults,
        metrics: {
          totalTime: 50,
          qualityScore: 0.8,
          enginePerformance: { mock: 50 }
        },
        validation: {
          passed: true,
          score: 0.8,
          issues: [],
          recommendations: ["This is a mock result. Configure search engines for real results."]
        },
        searchId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        note: "Mock results - search engines not configured"
      });
    }

  } catch (error) {
    console.error("Search API critical error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}