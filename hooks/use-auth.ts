'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  authProvider, 
  type User, 
  type Session, 
  type AuthStatus,
  type AuthCredentials,
  type SignUpData,
} from '@/lib/auth'

interface UseAuthReturn {
  user: User | null
  session: Session | null
  status: AuthStatus
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (credentials: AuthCredentials) => Promise<{ success: boolean; error?: string }>
  signUp: (data: SignUpData) => Promise<{ success: boolean; error?: string; requiresConfirmation?: boolean }>
  signOut: () => Promise<{ success: boolean; error?: string }>
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    // Carrega sessão inicial
    const loadSession = async () => {
      try {
        const currentSession = await authProvider.getSession()
        if (currentSession) {
          setSession(currentSession)
          setUser(currentSession.user)
          setStatus('authenticated')
        } else {
          setStatus('unauthenticated')
        }
      } catch {
        setStatus('unauthenticated')
      }
    }

    loadSession()

    // Escuta mudanças de autenticação
    const unsubscribe = authProvider.onAuthStateChange((event) => {
      if (event.type === 'SIGNED_IN' || event.type === 'TOKEN_REFRESHED') {
        setSession(event.session)
        setUser(event.session?.user || null)
        setStatus('authenticated')
      } else if (event.type === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        setStatus('unauthenticated')
      }
    })

    return () => unsubscribe()
  }, [])

  const signIn = useCallback(async (credentials: AuthCredentials) => {
    const result = await authProvider.signIn(credentials)
    return { success: result.success, error: result.error }
  }, [])

  const signUp = useCallback(async (data: SignUpData) => {
    const result = await authProvider.signUp(data)
    return { 
      success: result.success, 
      error: result.error,
      requiresConfirmation: result.requiresConfirmation,
    }
  }, [])

  const signOut = useCallback(async () => {
    return await authProvider.signOut()
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    return await authProvider.resetPassword(email)
  }, [])

  return {
    user,
    session,
    status,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    signIn,
    signUp,
    signOut,
    resetPassword,
  }
}
