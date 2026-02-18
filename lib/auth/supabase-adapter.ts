// Implementação do AuthProvider usando Supabase
// Este arquivo é o ÚNICO lugar que conhece o Supabase

import { BaseAuthProvider } from './auth-provider'
import type {
  User,
  Session,
  AuthCredentials,
  SignUpData,
  AuthResult,
  AuthEventCallback,
  AuthEvent,
} from './types'
import { createClient } from '@/utils/supabase/client'
import type {
  AuthChangeEvent,
  Session as SupabaseSession,
  User as SupabaseUser,
} from '@supabase/supabase-js'

export class SupabaseAuthAdapter extends BaseAuthProvider {
  readonly name = 'supabase'
  private supabase = createClient()

  // Mapeia usuário do Supabase para nosso tipo User
  private mapUser(supabaseUser: SupabaseUser | null): User | null {
    if (!supabaseUser) return null

    return {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      username: supabaseUser.user_metadata?.username as string | undefined,
      avatarUrl: supabaseUser.user_metadata?.avatar_url as string | undefined,
      createdAt: new Date(supabaseUser.created_at || Date.now()),
      metadata: supabaseUser.user_metadata,
    }
  }

  // Mapeia sessão do Supabase para nosso tipo Session
  private mapSession(supabaseSession: SupabaseSession | null): Session | null {
    if (!supabaseSession) return null

    const user = this.mapUser(supabaseSession.user)
    if (!user) return null

    return {
      user,
      accessToken: supabaseSession.access_token,
      refreshToken: supabaseSession.refresh_token,
      expiresAt: supabaseSession.expires_at 
        ? new Date(supabaseSession.expires_at * 1000) 
        : undefined,
    }
  }

  async signIn(credentials: AuthCredentials): Promise<AuthResult> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      })

      if (error) {
        return { success: false, error: this.mapError(error) }
      }

      return {
        success: true,
        user: this.mapUser(data.user) || undefined,
        session: this.mapSession(data.session) || undefined,
      }
    } catch (error) {
      return { success: false, error: this.mapError(error) }
    }
  }

  async signUp(data: SignUpData): Promise<AuthResult> {
    try {
      const { data: authData, error } = await this.supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || window.location.origin + '/chat',
          data: {
            username: data.username,
            ...data.metadata,
          },
        },
      })

      if (error) {
        return { success: false, error: this.mapError(error) }
      }

      // Supabase pode retornar user sem session se confirmação de email está habilitada
      const requiresConfirmation = !authData.session && !!authData.user

      return {
        success: true,
        user: this.mapUser(authData.user) || undefined,
        session: this.mapSession(authData.session) || undefined,
        requiresConfirmation,
      }
    } catch (error) {
      return { success: false, error: this.mapError(error) }
    }
  }

  async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase.auth.signOut()

      if (error) {
        return { success: false, error: this.mapError(error) }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: this.mapError(error) }
    }
  }

  async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        return { success: false, error: this.mapError(error) }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: this.mapError(error) }
    }
  }

  async updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        return { success: false, error: this.mapError(error) }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: this.mapError(error) }
    }
  }

  async getSession(): Promise<Session | null> {
    try {
      const { data: { session } } = await this.supabase.auth.getSession()
      return this.mapSession(session)
    } catch {
      return null
    }
  }

  async getUser(): Promise<User | null> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      return this.mapUser(user)
    } catch {
      return null
    }
  }

  async refreshSession(): Promise<Session | null> {
    try {
      const { data: { session } } = await this.supabase.auth.refreshSession()
      return this.mapSession(session)
    } catch {
      return null
    }
  }

  onAuthStateChange(callback: AuthEventCallback): () => void {
    const { data: { subscription } } = this.supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: SupabaseSession | null) => {
        const mappedEvent: AuthEvent = {
          type: this.mapEventType(event),
          session: this.mapSession(session),
        }
        callback(mappedEvent)
      }
    )

    return () => subscription.unsubscribe()
  }

  private mapEventType(supabaseEvent: AuthChangeEvent | string): AuthEvent['type'] {
    const eventMap: Record<string, AuthEvent['type']> = {
      'SIGNED_IN': 'SIGNED_IN',
      'SIGNED_OUT': 'SIGNED_OUT',
      'TOKEN_REFRESHED': 'TOKEN_REFRESHED',
      'USER_UPDATED': 'USER_UPDATED',
      'PASSWORD_RECOVERY': 'PASSWORD_RECOVERY',
    }
    return eventMap[supabaseEvent] || 'SIGNED_IN'
  }

  // OAuth - específico do Supabase
  async signInWithOAuth(provider: string, redirectTo?: string): Promise<AuthResult> {
    try {
      const { error } = await this.supabase.auth.signInWithOAuth({
        provider: provider as 'google' | 'github' | 'discord',
        options: {
          redirectTo: redirectTo || `${window.location.origin}/chat`,
        },
      })

      if (error) {
        return { success: false, error: this.mapError(error) }
      }

      // OAuth redireciona, então não retorna dados aqui
      return { success: true }
    } catch (error) {
      return { success: false, error: this.mapError(error) }
    }
  }
}
