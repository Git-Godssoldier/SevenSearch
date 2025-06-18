'use client'

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
// Import the mock user ID constant from the auth utilities
import { MOCK_USER_ID } from "@/lib/auth"

export function AuthStatusIndicator() {
  const { data: session, status } = useSession()
  const [isBypassMode, setIsBypassMode] = useState(false)
  
  useEffect(() => {
    // If the session is authenticated and the user ID is the mock user ID,
    // then we are in bypass mode.
    if (status === "authenticated" && session?.user?.id === MOCK_USER_ID) {
      setIsBypassMode(true)
    } else {
      setIsBypassMode(false)
    }
  }, [session, status])
  
  if (!isBypassMode) {
    return null
  }
  
  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        padding: '8px 12px',
        backgroundColor: 'rgba(255, 230, 153, 0.9)', 
        color: '#333',
        borderRadius: '6px',
        fontSize: '12px',
        zIndex: 10000,
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
      }}
    >
      Auth Bypass Active (Anonymous User)
    </div>
  )
}
