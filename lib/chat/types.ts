// Tipos compartilhados para o sistema de chat
// Estes tipos são agnósticos ao provedor (Supabase, WebSocket, Polling, etc.)

export interface TaskProposal {
  title: string
  description?: string
  steps: string[]
  estimated_commands: number
  risk_level?: 'low' | 'medium' | 'high'
  max_commands?: number
  commands_used?: number
}

export interface Message {
  id: string
  content: string
  userId: string
  username: string
  roomId: string
  timestamp: number
  status?: 'sending' | 'sent' | 'delivered' | 'read'
  // Task approval system
  message_type?: 'message' | 'task_proposal' | 'task_approval' | 'task_execution' | 'handover'
  task_id?: string
  task_data?: TaskProposal
}

export interface Conversation {
  id: string
  name: string
  avatar?: string
  lastMessage?: string
  lastMessageTime?: number
  unreadCount: number
  isOnline?: boolean
  isGroup?: boolean
  participantUserId?: string
  participantType?: 'human' | 'llm' | 'computer'
}

export interface User {
  id: string
  username: string
}

export interface ChatRoom {
  id: string
  name: string
}

// Callback para receber mensagens em tempo real
export type MessageCallback = (message: Message) => void

// Função de cleanup para unsubscribe
export type Unsubscribe = () => void

// Status da conexão
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export type ConnectionStatusCallback = (status: ConnectionStatus) => void

export interface ChatProviderConfig {
  url?: string
  pollingInterval?: number
  reconnectAttempts?: number
  reconnectDelay?: number
}

export interface ChatEvents {
  onMessage: (message: Message) => void
  onStatusChange: (status: ConnectionStatus) => void
  onError: (error: Error) => void
}
