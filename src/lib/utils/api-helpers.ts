import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

// Environment variable check for auth bypass
export const isAuthBypassEnabled = process.env.AUTH_BYPASS_ENABLED === 'true';

// Default mock user ID for auth bypass
export const MOCK_USER_ID = "mock-user-id-12345";

/**
 * Handles authentication for API routes with automatic fallback
 * @returns {string} User ID (real or mock)
 */
export async function getAuthenticatedUserId(): Promise<string> {
  // If auth bypass is enabled, always return the mock user ID
  if (isAuthBypassEnabled) {
    console.log("Auth bypass enabled, using mock user ID");
    return MOCK_USER_ID;
  }
  
  // Try to get authenticated user, but fall back to mock ID
  try {
    const session = await auth();
    if (session?.user?.id) {
      return session.user.id;
    } else {
      console.log("No valid session, using mock user ID");
    }
  } catch (error) {
    console.error("Authentication error:", error);
  }
  
  // Fall back to mock user ID
  return MOCK_USER_ID;
}

/**
 * Wraps an API route handler with authentication handling
 */
export function withAuth<T>(
  handler: (req: NextRequest, userId: string) => Promise<T>
) {
  return async function(req: NextRequest): Promise<T> {
    const userId = await getAuthenticatedUserId();
    return handler(req, userId);
  };
}