// Ponto central de exportação do módulo de autenticação
// Para trocar de provedor, apenas mude a importação aqui

export * from './types'
export * from './auth-provider'

// ============================================
// CONFIGURAÇÃO DO PROVEDOR DE AUTENTICAÇÃO
// ============================================
// Para trocar de provedor, comente/descomente as linhas abaixo:

// Opção 1: Supabase (atual)
import { SupabaseAuthAdapter } from './supabase-adapter'
export const authProvider = new SupabaseAuthAdapter()

// Opção 2: Firebase (exemplo futuro)
// import { FirebaseAuthAdapter } from './firebase-adapter'
// export const authProvider = new FirebaseAuthAdapter()

// Opção 3: Auth customizado (exemplo futuro)
// import { CustomAuthAdapter } from './custom-adapter'
// export const authProvider = new CustomAuthAdapter('https://seu-auth-server.com')
