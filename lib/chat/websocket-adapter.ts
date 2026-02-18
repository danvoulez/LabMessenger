import type { ChatProvider } from './chat-provider'
import type {
  Message,
  MessageCallback,
  Unsubscribe,
  ConnectionStatus,
  ConnectionStatusCallback,
} from './types'

/**
 * Adapter WebSocket genérico.
 * 
 * Conecta a QUALQUER servidor WebSocket que siga o protocolo:
 * 
 * Mensagens do servidor -> cliente:
 * { type: 'message', payload: Message }
 * { type: 'history', payload: Message[] }
 * { type: 'error', payload: { message: string } }
 * 
 * Mensagens do cliente -> servidor:
 * { type: 'join', payload: { roomId: string } }
 * { type: 'message', payload: { content, userId, username, roomId } }
 * { type: 'get_history', payload: { roomId: string } }
 * 
 * Exemplos de uso:
 * - Cloudflare Workers: wss://seu-worker.workers.dev
 * - Servidor local: ws://localhost:8080
 * - Qualquer servidor WebSocket compatível
 */
export class WebSocketAdapter implements ChatProvider {
  private ws: WebSocket | null = null
  private url: string
  private currentRoomId: string | null = null
  private messageCallbacks: Set<MessageCallback> = new Set()
  private statusCallbacks: Set<ConnectionStatusCallback> = new Set()
  private status: ConnectionStatus = 'disconnected'
  private messageQueue: Message[] = []
  private pendingHistoryResolve: ((messages: Message[]) => void) | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(url: string) {
    this.url = url
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

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      this.setStatus('connecting')

      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          this.setStatus('connected')
          this.reconnectAttempts = 0
          
          // Re-join room if we had one
          if (this.currentRoomId) {
            this.ws?.send(JSON.stringify({
              type: 'join',
              payload: { roomId: this.currentRoomId }
            }))
          }
          
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            
            switch (data.type) {
              case 'message':
                const message: Message = this.normalizeMessage(data.payload)
                this.messageCallbacks.forEach(cb => cb(message))
                break
                
              case 'history':
                const messages = data.payload.map((m: any) => this.normalizeMessage(m))
                if (this.pendingHistoryResolve) {
                  this.pendingHistoryResolve(messages)
                  this.pendingHistoryResolve = null
                }
                break
                
              case 'error':
                console.error('[Chat] Server error:', data.payload.message)
                break
            }
          } catch (e) {
            console.error('[Chat] Failed to parse message:', e)
          }
        }

        this.ws.onclose = () => {
          this.setStatus('disconnected')
          this.attemptReconnect()
        }

        this.ws.onerror = () => {
          this.setStatus('error')
          reject(new Error('WebSocket connection failed'))
        }
      } catch (error) {
        this.setStatus('error')
        reject(error)
      }
    })
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(() => {
        // Will retry via onclose
      })
    }, delay)
  }

  async sendMessage(params: {
    content: string
    userId: string
    username: string
    roomId: string
  }): Promise<Message> {
    await this.connect()

    const message: Message = {
      id: crypto.randomUUID(),
      content: params.content,
      userId: params.userId,
      username: params.username,
      roomId: params.roomId,
      timestamp: Date.now(),
    }

    this.ws?.send(JSON.stringify({
      type: 'message',
      payload: message
    }))

    return message
  }

  async getMessages(roomId: string): Promise<Message[]> {
    await this.connect()

    return new Promise((resolve) => {
      this.pendingHistoryResolve = resolve
      
      this.ws?.send(JSON.stringify({
        type: 'get_history',
        payload: { roomId }
      }))

      // Timeout fallback
      setTimeout(() => {
        if (this.pendingHistoryResolve) {
          this.pendingHistoryResolve([])
          this.pendingHistoryResolve = null
        }
      }, 5000)
    })
  }

  subscribe(roomId: string, callback: MessageCallback): Unsubscribe {
    this.currentRoomId = roomId
    this.messageCallbacks.add(callback)

    this.connect().then(() => {
      this.ws?.send(JSON.stringify({
        type: 'join',
        payload: { roomId }
      }))
    })

    return () => {
      this.messageCallbacks.delete(callback)
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
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }
    this.ws?.close()
    this.ws = null
    this.messageCallbacks.clear()
    this.statusCallbacks.clear()
    this.setStatus('disconnected')
  }
}
