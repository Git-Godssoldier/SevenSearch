// This file provides a public authentication bypass for production deployments
// It uses credential authentication with a fixed anonymous user

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Fixed anonymous user details
const ANONYMOUS_USER = {
  id: "mock-user-id-12345",
  name: "Anonymous User",
  email: "anonymous@example.com",
  image: null,
  hasApiKey: true
};

export const publicAuthOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Public Access",
      credentials: {
        // No credentials needed - automatic login
      },
      async authorize() {
        // Always return the anonymous user
        return ANONYMOUS_USER;
      },
    }),
  ],
  callbacks: {
    async session({ session }) {
      // Enhance the session with the anonymous user details
      if (!session.user) {
        session.user = {};
      }
      
      session.user.id = ANONYMOUS_USER.id;
      session.user.name = ANONYMOUS_USER.name;
      session.user.email = ANONYMOUS_USER.email;
      session.user.image = ANONYMOUS_USER.image;
      session.user.hasApiKey = ANONYMOUS_USER.hasApiKey;
      session.user.apiKey = null;
      
      return session;
    },
    async jwt({ token }) {
      // Enhance the JWT token with anonymous user details
      token.sub = ANONYMOUS_USER.id;
      token.name = ANONYMOUS_USER.name;
      token.email = ANONYMOUS_USER.email;
      token.picture = ANONYMOUS_USER.image;
      
      return token;
    }
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || "supersecret",
  pages: {
    signIn: '/',  // Just redirect to home page for sign in
    error: '/',   // Just redirect to home page for errors
  }
};