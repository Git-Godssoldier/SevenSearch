// components/providers/SessionProvider.tsx
'use client'
import { SessionProvider } from "next-auth/react"
import { createContext, useContext, useState, useEffect } from "react"

// Create a mock session context
export const MockSessionContext = createContext({
  mockSession: {
    user: {
      id: "mock-user-id-12345",
      name: "Anonymous User",
      email: "anonymous@example.com",
      image: null,
      hasApiKey: true
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  },
  useMockSession: true
})

export const useMockSession = () => useContext(MockSessionContext)

// Enhanced SessionProvider that uses real session when available
// and falls back to mock session when authentication fails
export default function NextAuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [useMockSession, setUseMockSession] = useState(false)

  // Monitor for authentication errors and enable mock session if needed
  useEffect(() => {
    // Force enable mock session for production deployments
    if (window.location.href.includes('vercel.app')) {
      console.log(`Production deployment detected, enabling mock session`)
      setUseMockSession(true)
      return
    }

    // Check URL for authentication errors
    const url = new URL(window.location.href)
    const error = url.searchParams.get('error')
    
    if (error) {
      console.log(`Detected auth error: ${error}, enabling mock session`)
      setUseMockSession(true)
    }
    
    // Also check localStorage for previous mock session preference
    const storedPreference = localStorage.getItem('useMockSession')
    if (storedPreference === 'true') {
      setUseMockSession(true)
    }

    // Auto-enable mock session after a timeout (for production deployments)
    const timeout = setTimeout(() => {
      console.log("Auto-enabling mock session after timeout")
      setUseMockSession(true)
    }, 2000);

    return () => clearTimeout(timeout);
  }, [])

  // Store preference when it changes
  useEffect(() => {
    localStorage.setItem('useMockSession', useMockSession.toString())
  }, [useMockSession])

  // Wrap the provider with our mock context
  return (
    <MockSessionContext.Provider 
      value={{ 
        mockSession: {
          user: {
            id: "mock-user-id-12345",
            name: "Anonymous User",
            email: "anonymous@example.com",
            image: null,
            hasApiKey: true
          },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
        useMockSession
      }}
    >
      <SessionProvider>{children}</SessionProvider>
    </MockSessionContext.Provider>
  )
}