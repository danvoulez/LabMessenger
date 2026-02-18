import type { ChatProvider } from './chat-provider'
import type {
  Message,
  MessageCallback,
  Unsubscribe,
  ConnectionStatus,
  ConnectionStatusCallback,
} from './types'

/**
 * Remote Agent Adapter - Conecta ao agente Claude no LAB 512
 * 
 * Funciona com o server.js do remote-agent que roda no LAB 512.
 * Envia mensagens, recebe respostas do Claude + outputs de comandos executados.
 * 
 * Usa polling para simplicidade (funciona em qualquer rede, sem WebSocket complexo)
 */
export class RemoteAgentAdapter implements ChatProvider {
  private agentUrl: string
  private pollingInterval: ReturnType<typeof setInterval> | null = null
  private pollIntervalMs: number
  private messageCallbacks: Set<MessageCallback> = new Set()
  private statusCallbacks: Set<ConnectionStatusCallback> = new Set()
  private status: ConnectionStatus = 'disconnected'
  private conversationId: string
  private lastMessageTimestamp: number = 0
  private localMessageCache: Message[] = []

  constructor(options: {
    agentUrl: string
    pollIntervalMs?: number
    conversationId?: string
  }) {
    this.agentUrl = options.agentUrl.replace(/\/$/, '') // Remove trailing slash
    this.pollIntervalMs = options.pollIntervalMs ?? 3000
    this.conversationId = options.conversationId ?? 'default'
  }

  private setStatus(status: ConnectionStatus) {
    if (this.status === status) return
    this.status = status
    this.statusCallbacks.forEach(cb => cb(status))
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async sendMessage(params: {
    content: string
    userId: string
    username: string
    roomId: string
  }): Promise<Message> {
    const localMessage: Message = {
      id: this.generateMessageId(),
      content: params.content,
      userId: params.userId,
      username: params.username,
      roomId: params.roomId,
      timestamp: Date.now(),
      status: 'sending'
    }

    // Adiciona à cache local imediatamente
    this.localMessageCache.push(localMessage)
    this.messageCallbacks.forEach(cb => cb(localMessage))

    try {
      this.setStatus('connecting')

      // Envia para o agente
      const response = await fetch(`${this.agentUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: params.content,
          conversationId: this.conversationId
        }),
        signal: AbortSignal.timeout(30000) // 30s timeout
      })

      if (!response.ok) {
        throw new Error(`Agent error: ${response.status}`)
      }

      this.setStatus('connected')

      const data = await response.json()

      // Atualiza status da mensagem enviada
      localMessage.status = 'sent'
      this.messageCallbacks.forEach(cb => cb(localMessage))

      // Cria mensagem de resposta do agente
      const agentMessage: Message = {
        id: this.generateMessageId(),
        content: data.response || 'Sem resposta do agente.',
        userId: 'agent',
        username: 'LAB 512 Agent',
        roomId: params.roomId,
        timestamp: Date.now(),
        status: 'delivered'
      }

      // Se teve comandos executados, adiciona ao final da mensagem
      if (data.executions && data.executions.length > 0) {
        const executionsText = '\n\n---\n**📋 Comandos Executados:**\n\n' + 
          data.executions.map((ex: any) => 
            `\`\`\`bash\n$ ${ex.command}\n${ex.output.substring(0, 500)}${ex.output.length > 500 ? '...' : ''}\n\`\`\``
          ).join('\n\n')
        
        agentMessage.content += executionsText
      }

      this.localMessageCache.push(agentMessage)
      this.lastMessageTimestamp = agentMessage.timestamp
      this.messageCallbacks.forEach(cb => cb(agentMessage))

      return localMessage

    } catch (error) {
      console.error('[RemoteAgent] Send failed:', error)
      this.setStatus('error')
      
      // Atualiza status para erro
      localMessage.status = 'sent' // Marca como enviada mesmo com erro
      
      // Envia mensagem de erro
      const errorMessage: Message = {
        id: this.generateMessageId(),
        content: `❌ Erro ao conectar com LAB 512:\n${error instanceof Error ? error.message : 'Erro desconhecido'}\n\n*Verifique se o servidor está rodando e acessível.*`,
        userId: 'system',
        username: 'Sistema',
        roomId: params.roomId,
        timestamp: Date.now(),
        status: 'delivered'
      }
      
      this.localMessageCache.push(errorMessage)
      this.messageCallbacks.forEach(cb => cb(errorMessage))
      
      throw error
    }
  }

  async getMessages(roomId: string): Promise<Message[]> {
    // Retorna cache local
    return this.localMessageCache.filter(m => m.roomId === roomId)
  }

  subscribe(roomId: string, callback: MessageCallback): Unsubscribe {
    this.messageCallbacks.add(callback)

    // Inicia polling para health check (verificar se servidor está online)
    if (!this.pollingInterval) {
      this.startHealthCheck()
    }

    return () => {
      this.messageCallbacks.delete(callback)
      if (this.messageCallbacks.size === 0) {
        this.stopHealthCheck()
      }
    }
  }

  private startHealthCheck() {
    this.pollingInterval = setInterval(async () => {
      try {
        const response = await fetch(`${this.agentUrl}/health`, {
          signal: AbortSignal.timeout(5000)
        })
        
        if (response.ok) {
          this.setStatus('connected')
        } else {
          this.setStatus('error')
        }
      } catch {
        this.setStatus('disconnected')
      }
    }, this.pollIntervalMs)
  }

  private stopHealthCheck() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  onConnectionChange(callback: ConnectionStatusCallback): Unsubscribe {
    this.statusCallbacks.add(callback)
    // Chama imediatamente com status atual
    callback(this.status)
    
    return () => {
      this.statusCallbacks.delete(callback)
    }
  }

  getConnectionStatus(): ConnectionStatus {
    return this.status
  }

  disconnect(): void {
    this.stopHealthCheck()
    this.messageCallbacks.clear()
    this.statusCallbacks.clear()
    this.setStatus('disconnected')
  }

  /**
   * Reseta a conversa no servidor
   */
  async resetConversation(): Promise<void> {
    try {
      await fetch(`${this.agentUrl}/reset`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000)
      })
      this.localMessageCache = []
      this.lastMessageTimestamp = 0
    } catch (error) {
      console.error('[RemoteAgent] Reset failed:', error)
    }
  }
}
