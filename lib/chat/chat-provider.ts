import type {
  Message,
  MessageCallback,
  Unsubscribe,
  ConnectionStatus,
  ConnectionStatusCallback,
} from './types'

/**
 * Interface abstrata para provedores de chat.
 * 
 * Para trocar de provedor (ex: Supabase -> Cloudflare WebSocket):
 * 1. Crie um novo arquivo implementando esta interface
 * 2. Troque a importação em lib/chat/index.ts
 * 
 * Provedores disponíveis:
 * - WebSocketAdapter: Conecta a qualquer servidor WebSocket (Cloudflare, seu PC, etc.)
 * - PollingAdapter: Fallback sem servidor externo (usa API routes locais)
 */
export interface ChatProvider {
  /**
   * Envia uma mensagem para uma sala
   */
  sendMessage(params: {
    content: string
    userId: string
    username: string
    roomId: string
  }): Promise<Message>

  /**
   * Busca mensagens de uma sala
   */
  getMessages(roomId: string): Promise<Message[]>

  /**
   * Inscreve-se para receber novas mensagens em tempo real
   * Retorna função para cancelar a inscrição
   */
  subscribe(roomId: string, callback: MessageCallback): Unsubscribe

  /**
   * Monitora status da conexão
   */
  onConnectionChange(callback: ConnectionStatusCallback): Unsubscribe

  /**
   * Status atual da conexão
   */
  getConnectionStatus(): ConnectionStatus

  /**
   * Desconecta e limpa recursos
   */
  disconnect(): void
}
