// Tipos compartilhados para autenticação
// Independente de qualquer provedor específico

export interface User {
  id: string
  email: string
  username?: string
  avatarUrl?: string
  createdAt: Date
  metadata?: Record<string, unknown>
}

export interface Session {
  user: User
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
}

export interface AuthCredentials {
  email: string
  password: string
}

export interface SignUpData extends AuthCredentials {
  username?: string
  metadata?: Record<string, unknown>
}

export interface AuthResult {
  success: boolean
  user?: User
  session?: Session
  error?: string
  requiresConfirmation?: boolean
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthState {
  status: AuthStatus
  user: User | null
  session: Session | null
}

export type AuthEventType = 
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'PASSWORD_RECOVERY'

export interface AuthEvent {
  type: AuthEventType
  session: Session | null
}

export type AuthEventCallback = (event: AuthEvent) => void
