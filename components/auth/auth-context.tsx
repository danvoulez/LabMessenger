'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useAuth } from '@/hooks/use-auth'

type AuthContextType = ReturnType<typeof useAuth>

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext deve ser usado dentro de um AuthProvider')
  }
  return context
}
