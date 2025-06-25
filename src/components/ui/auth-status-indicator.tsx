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
    <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-secondary/20 bg-secondary/10 px-3 py-2 text-xs font-medium text-secondary shadow-lg">
      Auth Bypass Active (Anonymous User)
    </div>
  )
}
