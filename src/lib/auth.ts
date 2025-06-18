// lib/auth.ts
import type {
  GetServerSidePropsContext,
  NextApiRequest,
  NextApiResponse,
} from "next"
import type { DefaultSession, NextAuthOptions } from "next-auth"
import { getServerSession } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { supabase } from "@/lib/supabase"
import { v5 as uuidv5 } from 'uuid' // Using UUID v5 for deterministic generation
import CryptoJS from 'crypto-js' // Import for encryption

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      hasApiKey?: boolean; // Add this field to track API key status
      apiKey?: string | null; 
    } & DefaultSession["user"]
  }
}

// Function to convert Google's sub to UUID
function googleSubToUUID(sub: string): string {
  // Use a namespace (DNS namespace in this case) and the sub to generate a consistent UUID
  const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // DNS namespace
  return uuidv5(sub, NAMESPACE);
}

// Check for auth bypass environment variable
export const isAuthBypassEnabled = process.env.AUTH_BYPASS_ENABLED === 'true';
export const MOCK_USER_ID = "mock-user-id-12345";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  },
  callbacks: {
    // In the session callback of auth.ts
async session({ session, token }) {
  // If auth bypass is enabled, create a mock user session
  if (isAuthBypassEnabled) {
    console.log("Auth bypass enabled in session callback, creating mock user");
    if (!session.user) {
      session.user = {};
    }
    
    session.user.id = MOCK_USER_ID;
    session.user.name = "Anonymous User";
    session.user.email = "anonymous@example.com";
    session.user.hasApiKey = true;
    session.user.apiKey = null;
    
    return session;
  }
  
  // Normal authentication flow when bypass is disabled
  if (session.user && token.sub) {
    // Convert Google sub to UUID
    const userId = googleSubToUUID(token.sub);
    session.user.id = userId;

    try {
      // Check if user exists in Supabase
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      // Only attempt to create a user if the table exists (error is not "does not exist")
      if (userError) {
        if (userError.message.includes('does not exist')) {
          console.log('Users table does not exist. Skipping user creation.');
          // Don't try to create the user as the table doesn't exist
        } else if (userError.code === 'PGRST116') {
          // This error means no user was found, but the table exists
          console.log(`User with ID ${userId} doesn't exist, creating new record`);

          // Insert new user if they don't exist
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: userId,
              full_name: session.user.name || '',
              email: session.user.email || '',
              created_at: new Date().toISOString()
            });

          if (insertError) {
            console.error('Error creating user:', insertError);
          }
        } else {
          // Some other error
          console.error('Error checking for user:', userError);
        }
      }
    } catch (error) {
      console.error('Exception during user management:', error);
      // Continue with authentication despite errors
    }

    // Always set hasApiKey to true to bypass the API key check
    session.user.hasApiKey = true;

    // Set apiKey to null - we'll handle this in the search workflow
    session.user.apiKey = null;
  } else {
    // If we have no user or token, provide a fallback mock user
    console.log("No valid user or token in session callback, creating fallback user");
    if (!session.user) {
      session.user = {};
    }
    
    session.user.id = MOCK_USER_ID;
    session.user.name = "Anonymous User";
    session.user.email = "anonymous@example.com";
    session.user.hasApiKey = true;
    session.user.apiKey = null;
  }

  return session;
}
  }
}

export function auth(
  ...args:
    | [GetServerSidePropsContext["req"], GetServerSidePropsContext["res"]]
    | [NextApiRequest, NextApiResponse]
    | []
) {
  return getServerSession(...args, authOptions)
}

// Add utility functions for API key management
export const encryptApiKey = (apiKey: string): string => {
  const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET as string;
  return CryptoJS.AES.encrypt(apiKey, ENCRYPTION_SECRET).toString();
};

export const decryptApiKey = (encryptedApiKey: string): string => {
  const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET as string;
  const bytes = CryptoJS.AES.decrypt(encryptedApiKey, ENCRYPTION_SECRET);
  return bytes.toString(CryptoJS.enc.Utf8);
};