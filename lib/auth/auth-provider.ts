// Interface abstrata para provedores de autenticação
// Qualquer provedor (Supabase, Firebase, Custom, etc.) deve implementar esta interface

import type {
  User,
  Session,
  AuthCredentials,
  SignUpData,
  AuthResult,
  AuthEventCallback,
} from './types'

export interface AuthProvider {
  // Identificador do provedor
  readonly name: string

  // Autenticação básica
  signIn(credentials: AuthCredentials): Promise<AuthResult>
  signUp(data: SignUpData): Promise<AuthResult>
  signOut(): Promise<{ success: boolean; error?: string }>

  // Recuperação de senha
  resetPassword(email: string): Promise<{ success: boolean; error?: string }>
  updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }>

  // Sessão
  getSession(): Promise<Session | null>
  getUser(): Promise<User | null>
  refreshSession(): Promise<Session | null>

  // Eventos de autenticação (para atualizações em tempo real)
  onAuthStateChange(callback: AuthEventCallback): () => void

  // OAuth (opcional - nem todos os provedores suportam)
  signInWithOAuth?(provider: string, redirectTo?: string): Promise<AuthResult>
}

// Classe base abstrata com implementações padrão
export abstract class BaseAuthProvider implements AuthProvider {
  abstract readonly name: string

  abstract signIn(credentials: AuthCredentials): Promise<AuthResult>
  abstract signUp(data: SignUpData): Promise<AuthResult>
  abstract signOut(): Promise<{ success: boolean; error?: string }>
  abstract resetPassword(email: string): Promise<{ success: boolean; error?: string }>
  abstract updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }>
  abstract getSession(): Promise<Session | null>
  abstract getUser(): Promise<User | null>
  abstract refreshSession(): Promise<Session | null>
  abstract onAuthStateChange(callback: AuthEventCallback): () => void

  // Método auxiliar para mapear erros de forma consistente
  protected mapError(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }
    if (typeof error === 'string') {
      return error
    }
    return 'Erro desconhecido'
  }
}
