// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"
import { publicAuthOptions } from "@/lib/public-auth"

// Check if we should use public auth (for Vercel deployment)
const isPublicAuthEnabled = process.env.AUTH_BYPASS_ENABLED === 'true';

// Use the appropriate auth options
const options = isPublicAuthEnabled ? publicAuthOptions : authOptions;
console.log(`[NextAuth] Using ${isPublicAuthEnabled ? 'public' : 'standard'} auth options, AUTH_BYPASS_ENABLED=${process.env.AUTH_BYPASS_ENABLED}`);

// The correct way to export handlers in App Router
const handler = NextAuth(options)
export { handler as GET, handler as POST }