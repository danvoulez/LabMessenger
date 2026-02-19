import type { ChatProvider } from './chat-provider'
import type {
  Message,
  MessageCallback,
  Unsubscribe,
  ConnectionStatus,
  ConnectionStatusCallback,
} from './types'
import { createClient } from '@/utils/supabase/client'

interface ConversationCache {
  agent_user_id: string
  agent_url: string
  cachedAt: number
}

export class SupabaseAgentAdapter implements ChatProvider {
  private supabase = createClient()
  private fallbackAgentUrl: string
  private statusCallbacks: Set<ConnectionStatusCallback> = new Set()
  private status: ConnectionStatus = 'disconnected'
  private realtimeChannel: ReturnType<typeof this.supabase.channel> | null = null
  private currentUserId: string | null = null

  // Cache de metadata de conversations (TTL 5min)
  private conversationCache = new Map<string, ConversationCache>()
  private readonly CACHE_TTL = 5 * 60 * 1000

  constructor(options: { agentUrl?: string } = {}) {
    this.fallbackAgentUrl = options.agentUrl?.replace(/\/$/, '') || ''
    this.checkConnection()
  }

  private setStatus(status: ConnectionStatus) {
    if (this.status === status) return
    this.status = status
    this.statusCallbacks.forEach((cb) => cb(status))
  }

  private mapDbMessage(msg: any): Message {
    return {
      id: msg.id,
      content: msg.content,
      userId: msg.user_id,
      username: msg.role === 'assistant' ? 'Agent' : 'Você',
      roomId: msg.conversation_id,
      timestamp: new Date(msg.created_at).getTime(),
      status: msg.status || 'sent',
      message_type: msg.message_type || 'message',
      task_id: msg.task_id ?? undefined,
      task_data: msg.task_data ?? undefined,
    }
  }

  /**
   * Mantido para extensões legadas (ex.: sender streaming)
   */
  private async getConversationMetadata(conversationId: string): Promise<ConversationCache> {
    const cached = this.conversationCache.get(conversationId)
    const now = Date.now()

    if (cached && now - cached.cachedAt < this.CACHE_TTL) {
      return cached
    }

    const { data, error } = await this.supabase
      .from('conversations')
      .select('agent_user_id, agent_url')
      .eq('id', conversationId)
      .single()

    if (error) throw error
    if (!data) throw new Error('Conversation not found')

    const metadata: ConversationCache = {
      agent_user_id: data.agent_user_id,
      agent_url: data.agent_url || this.fallbackAgentUrl,
      cachedAt: now,
    }

    this.conversationCache.set(conversationId, metadata)
    return metadata
  }

  clearCache(conversationId?: string) {
    if (conversationId) {
      this.conversationCache.delete(conversationId)
      return
    }
    this.conversationCache.clear()
  }

  private async checkConnection() {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser()
      this.currentUserId = user?.id || null
      this.setStatus(user ? 'connected' : 'disconnected')
    } catch {
      this.setStatus('error')
    }
  }

  async sendMessage(params: {
    content: string
    userId: string
    username: string
    roomId: string
  }): Promise<Message> {
    try {
      const { data, error } = await this.supabase
        .from('messages')
        .insert({
          conversation_id: params.roomId,
          user_id: params.userId,
          role: 'user',
          content: params.content,
          status: 'sent',
        })
        .select()
        .single()

      if (error) throw error

      this.setStatus('connected')
      return this.mapDbMessage(data)
    } catch (error) {
      console.error('[SupabaseAgent] Send failed:', error)
      this.setStatus('error')
      throw error
    }
  }

  async getMessages(roomId: string): Promise<Message[]> {
    const { data, error } = await this.supabase
      .from('messages')
      .select(`
        id,
        content,
        user_id,
        role,
        conversation_id,
        created_at,
        status,
        message_type,
        task_id,
        task_data
      `)
      .eq('conversation_id', roomId)
      .order('created_at', { ascending: true })

    if (error) throw error

    return (data || [])
      .filter((msg: any) => msg.message_type !== 'handover')
      .map((msg: any) => this.mapDbMessage(msg))
  }

  subscribe(roomId: string, callback: MessageCallback): Unsubscribe {
    this.setStatus('connecting')

    this.realtimeChannel = this.supabase
      .channel(`messages:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${roomId}`,
        },
        (payload: any) => {
          const msg = payload.new as any
          if (msg.message_type === 'handover') return
          callback(this.mapDbMessage(msg))
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') this.setStatus('connected')
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') this.setStatus('error')
        if (status === 'CLOSED') this.setStatus('disconnected')
      })

    return () => {
      this.realtimeChannel?.unsubscribe()
      this.realtimeChannel = null
    }
  }

  onConnectionChange(callback: ConnectionStatusCallback): Unsubscribe {
    this.statusCallbacks.add(callback)
    callback(this.status)
    return () => this.statusCallbacks.delete(callback)
  }

  getConnectionStatus(): ConnectionStatus {
    return this.status
  }

  disconnect(): void {
    this.realtimeChannel?.unsubscribe()
    this.realtimeChannel = null
    this.statusCallbacks.clear()
    this.setStatus('disconnected')
  }

  async createConversation(
    userId: string,
    agentUserId: string,
    agentUrl: string = this.fallbackAgentUrl,
    title?: string
  ): Promise<{ id: string }> {
    const { data, error } = await this.supabase
      .from('conversations')
      .insert({
        user_id: userId,
        agent_user_id: agentUserId,
        agent_url: agentUrl || null,
        title: title || 'Nova Conversa',
      })
      .select()
      .single()

    if (error) throw error
    return { id: data.id }
  }

  async getConversations(userId: string): Promise<Array<{
    id: string
    title: string
    lastMessageAt: Date
    updatedAt: Date
    agentUserId: string
    agentDisplayName?: string
    agentType?: 'human' | 'llm' | 'computer'
  }>> {
    const { data, error } = await this.supabase
      .from('conversations')
      .select('id, title, last_message_at, updated_at, agent_user_id')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) throw error

    const conversationRows = data || []
    const agentIds = Array.from(
      new Set(
        conversationRows
          .map((conv: any) => conv.agent_user_id)
          .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)
      )
    )

    let profileByUserId = new Map<string, { display_name: string; user_type: 'human' | 'llm' | 'computer' }>()
    if (agentIds.length > 0) {
      const { data: profileRows } = await this.supabase
        .from('user_profiles')
        .select('user_id, display_name, user_type')
        .in('user_id', agentIds)

      profileByUserId = new Map(
        (profileRows || []).map((profile: any) => [
          profile.user_id,
          {
            display_name: profile.display_name,
            user_type: profile.user_type,
          },
        ])
      )
    }

    return conversationRows.map((conv: any) => ({
      id: conv.id,
      title: conv.title,
      lastMessageAt: new Date(conv.last_message_at || conv.updated_at),
      updatedAt: new Date(conv.updated_at),
      agentUserId: conv.agent_user_id,
      agentDisplayName: profileByUserId.get(conv.agent_user_id)?.display_name,
      agentType: profileByUserId.get(conv.agent_user_id)?.user_type,
    }))
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const { error } = await this.supabase.from('conversations').delete().eq('id', conversationId)
    if (error) throw error
  }

  async approveTask(
    conversationId: string,
    taskId: string,
    userId: string,
    maxCommands: number = 10
  ): Promise<void> {
    const { error: updateError } = await this.supabase
      .from('messages')
      .update({
        task_data: {
          max_commands: maxCommands,
        },
      })
      .eq('task_id', taskId)
      .eq('message_type', 'task_proposal')

    if (updateError) throw updateError

    const { error: insertError } = await this.supabase.from('messages').insert({
      conversation_id: conversationId,
      user_id: userId,
      role: 'user',
      content: `APPROVED:${taskId}:${maxCommands}`,
      message_type: 'task_approval',
      task_id: taskId,
      status: 'sent',
    })

    if (insertError) throw insertError
  }

  async rejectTask(conversationId: string, taskId: string, userId: string): Promise<void> {
    const { error } = await this.supabase.from('messages').insert({
      conversation_id: conversationId,
      user_id: userId,
      role: 'user',
      content: `REJECTED:${taskId}`,
      message_type: 'message',
      status: 'sent',
    })

    if (error) throw error
  }
}
