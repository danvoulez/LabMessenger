/**
 * Chat Module - Ponto de entrada
 * 
 * ==========================================
 * PARA TROCAR DE PROVEDOR, EDITE APENAS AQUI
 * ==========================================
 * 
 * Opção 1: Supabase + Agent (RECOMENDADO - Produção)
 * ---------------------------------------------------
 * import { SupabaseAgentAdapter } from './supabase-agent-adapter'
 * export const chatProvider = new SupabaseAgentAdapter()
 * 
 * Opção 2: Remote Agent (Desenvolvimento - sem persistência)
 * ----------------------------------------------------------
 * import { RemoteAgentAdapter } from './remote-agent-adapter'
 * export const chatProvider = new RemoteAgentAdapter({
 *   agentUrl: 'http://localhost:3737'
 * })
 * 
 * Opção 3: WebSocket (tempo real puro)
 * ------------------------------------
 * import { WebSocketAdapter } from './websocket-adapter'
 * export const chatProvider = new WebSocketAdapter('wss://seu-servidor.com')
 * 
 * Opção 4: Polling (fallback sem servidor)
 * ----------------------------------------
 * import { PollingAdapter } from './polling-adapter'
 * export const chatProvider = new PollingAdapter()
 * 
 * ==========================================
 */

import { SupabaseAgentAdapter } from './supabase-agent-adapter'

// Usando Supabase + Realtime
// ✅ Persistência permanente
// ✅ Múltiplas conversas
// ✅ Sincroniza entre dispositivos
// ✅ Agent processa mensagens via Supabase Realtime (sem fetch /chat no frontend)
export const chatProvider = new SupabaseAgentAdapter({
  // Mantido como fallback de metadados para fluxos legados
  agentUrl: process.env.NEXT_PUBLIC_AGENT_URL,
})

// Re-export types and interfaces
export type { ChatProvider } from './chat-provider'
export type {
  Message,
  User,
  ChatRoom,
  MessageCallback,
  Unsubscribe,
  ConnectionStatus,
  ConnectionStatusCallback,
} from './types'
export { SupabaseAgentAdapter } from './supabase-agent-adapter'

// Re-export adapters for custom usage
export { WebSocketAdapter } from './websocket-adapter'
export { PollingAdapter } from './polling-adapter'
export { RemoteAgentAdapter } from './remote-agent-adapter'
