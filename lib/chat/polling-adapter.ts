import type { ChatProvider } from './chat-provider'
import type {
  Message,
  MessageCallback,
  Unsubscribe,
  ConnectionStatus,
  ConnectionStatusCallback,
} from './types'

/**
 * Adapter de Polling - Fallback sem servidor externo.
 * 
 * Usa API routes do Next.js para persistir mensagens.
 * Faz polling a cada X segundos para buscar novas mensagens.
 * 
 * Útil para:
 * - Testar a UI enquanto não tem servidor WebSocket
 * - Ambientes onde WebSocket não funciona
 * - Desenvolvimento local
 */
export class PollingAdapter implements ChatProvider {
  private pollingInterval: ReturnType<typeof setInterval> | null = null
  private pollIntervalMs: number
  private apiBasePath: string
  private messageCallbacks: Set<MessageCallback> = new Set()
  private statusCallbacks: Set<ConnectionStatusCallback> = new Set()
  private status: ConnectionStatus = 'disconnected'
  private lastMessageId: string | null = null
  private currentRoomId: string | null = null

  constructor(options?: { 
    pollIntervalMs?: number
    apiBasePath?: string 
  }) {
    this.pollIntervalMs = options?.pollIntervalMs ?? 2000
    this.apiBasePath = options?.apiBasePath ?? '/api/chat'
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status
    this.statusCallbacks.forEach(cb => cb(status))
  }

  private normalizeMessage(raw: any): Message {
    const timestamp =
      typeof raw?.timestamp === 'number'
        ? raw.timestamp
        : new Date(raw?.createdAt || Date.now()).getTime()

    return {
      ...raw,
      timestamp,
    }
  }

  async sendMessage(params: {
    content: string
    userId: string
    username: string
    roomId: string
  }): Promise<Message> {
    const response = await fetch(`${this.apiBasePath}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })

    if (!response.ok) {
      throw new Error('Failed to send message')
    }

    const message = await response.json()
    return this.normalizeMessage(message)
  }

  async getMessages(roomId: string): Promise<Message[]> {
    const response = await fetch(
      `${this.apiBasePath}/messages?roomId=${encodeURIComponent(roomId)}`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch messages')
    }

    const messages = await response.json()
    return messages.map((m: any) => this.normalizeMessage(m))
  }

  private async poll() {
    if (!this.currentRoomId) return

    try {
      const url = new URL(`${this.apiBasePath}/messages`, window.location.origin)
      url.searchParams.set('roomId', this.currentRoomId)
      if (this.lastMessageId) {
        url.searchParams.set('after', this.lastMessageId)
      }

      const response = await fetch(url.toString())
      
      if (!response.ok) {
        this.setStatus('error')
        return
      }

      this.setStatus('connected')

      const messages: any[] = await response.json()
      
      for (const rawMessage of messages) {
        const message = this.normalizeMessage(rawMessage)
        this.lastMessageId = message.id
        this.messageCallbacks.forEach(cb => cb(message))
      }
    } catch {
      this.setStatus('error')
    }
  }

  subscribe(roomId: string, callback: MessageCallback): Unsubscribe {
    this.currentRoomId = roomId
    this.messageCallbacks.add(callback)
    this.setStatus('connecting')

    // Start polling
    if (!this.pollingInterval) {
      this.poll() // Initial poll
      this.pollingInterval = setInterval(() => this.poll(), this.pollIntervalMs)
    }

    return () => {
      this.messageCallbacks.delete(callback)
      if (this.messageCallbacks.size === 0) {
        this.stopPolling()
      }
    }
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  onConnectionChange(callback: ConnectionStatusCallback): Unsubscribe {
    this.statusCallbacks.add(callback)
    callback(this.status)
    return () => {
      this.statusCallbacks.delete(callback)
    }
  }

  getConnectionStatus(): ConnectionStatus {
    return this.status
  }

  disconnect(): void {
    this.stopPolling()
    this.messageCallbacks.clear()
    this.statusCallbacks.clear()
    this.lastMessageId = null
    this.currentRoomId = null
    this.setStatus('disconnected')
  }
}
