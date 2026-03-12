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
   * Envia um arquivo como mensagem anexada.
   * Opcional para adapters legados.
   */
  sendAttachment?(params: {
    file: File
    userId: string
    username: string
    roomId: string
    caption?: string
  }): Promise<Message>

  /**
   * Aprova execução de tarefa proposta pelo agente.
   * Opcional para adapters legados.
   */
  approveTask?(
    conversationId: string,
    taskId: string,
    userId: string,
    maxCommands?: number
  ): Promise<void>

  /**
   * Rejeita execução de tarefa proposta pelo agente.
   * Opcional para adapters legados.
   */
  rejectTask?(conversationId: string, taskId: string, userId: string, reason?: string): Promise<void>

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
