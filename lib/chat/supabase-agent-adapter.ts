import type { ChatProvider } from './chat-provider'
import type {
  Message,
  MessageAttachment,
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

interface DbAttachmentRow {
  id: string
  bucket_id: string
  storage_path: string
  file_name: string
  mime_type: string
  size_bytes: number
  created_at: string
}

interface DbConversationMessagePreviewRow {
  conversation_id: string
  content: string
  created_at: string
  role: 'user' | 'assistant' | 'system'
  message_type?: 'message' | 'task_proposal' | 'task_approval' | 'task_execution' | 'handover' | 'file'
}

interface DbObservabilityRow {
  user_id: string
  status: 'healthy' | 'warning' | 'critical'
  updated_at: string
}

const ATTACHMENTS_BUCKET = 'chat-files'
const SIGNED_URL_EXPIRES_IN_SECONDS = 300
const ONLINE_STALE_AFTER_MS = 5 * 60 * 1000

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

  private async mapAttachments(rows: DbAttachmentRow[] | undefined): Promise<MessageAttachment[]> {
    if (!rows || rows.length === 0) return []

    const mapped = await Promise.all(
      rows.map(async (row): Promise<MessageAttachment> => {
        let url: string | undefined
        try {
          const { data } = await this.supabase.storage
            .from(row.bucket_id || ATTACHMENTS_BUCKET)
            .createSignedUrl(row.storage_path, SIGNED_URL_EXPIRES_IN_SECONDS)
          url = data?.signedUrl
        } catch {
          url = undefined
        }

        return {
          id: row.id,
          fileName: row.file_name,
          mimeType: row.mime_type,
          sizeBytes: row.size_bytes,
          storagePath: row.storage_path,
          bucketId: row.bucket_id || ATTACHMENTS_BUCKET,
          url,
          createdAt: new Date(row.created_at).getTime(),
        }
      })
    )

    return mapped
  }

  private async mapDbMessage(msg: any): Promise<Message> {
    const attachments = await this.mapAttachments(msg.message_attachments as DbAttachmentRow[] | undefined)

    return {
      id: msg.id,
      content: msg.content,
      userId: msg.user_id,
      username: msg.role === 'assistant' ? 'Agent' : msg.role === 'system' ? 'Sistema' : 'Você',
      roomId: msg.conversation_id,
      timestamp: new Date(msg.created_at).getTime(),
      status: msg.status || 'sent',
      message_type: msg.message_type || 'message',
      task_id: msg.task_id ?? undefined,
      task_data: msg.task_data ?? undefined,
      attachments,
    }
  }

  private sanitizeFileName(fileName: string): string {
    const normalized = fileName.normalize('NFKD').replace(/[^\x00-\x7F]/g, '')
    return normalized.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 120) || 'file'
  }

  private async getMessageById(messageId: string): Promise<Message | null> {
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
        task_data,
        message_attachments (
          id,
          bucket_id,
          storage_path,
          file_name,
          mime_type,
          size_bytes,
          created_at
        )
      `)
      .eq('id', messageId)
      .maybeSingle()

    if (error) throw error
    if (!data) return null
    return this.mapDbMessage(data)
  }

  private async handleRealtimeInsert(raw: any, callback: MessageCallback) {
    try {
      if (raw.message_type === 'handover') return

      if (raw.message_type === 'file') {
        await new Promise((resolve) => setTimeout(resolve, 300))
        const fullMessage = await this.getMessageById(raw.id)
        if (fullMessage) {
          callback(fullMessage)
          return
        }
      }

      callback(await this.mapDbMessage(raw))
    } catch (error) {
      console.error('[SupabaseAgent] Failed to map realtime message:', error)
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
      return await this.mapDbMessage(data)
    } catch (error) {
      console.error('[SupabaseAgent] Send failed:', error)
      this.setStatus('error')
      throw error
    }
  }

  async sendAttachment(params: {
    file: File
    userId: string
    username: string
    roomId: string
    caption?: string
  }): Promise<Message> {
    let uploaded = false
    let storagePath = ''
    const messageId = crypto.randomUUID()
    const fileName = this.sanitizeFileName(params.file.name || 'file')
    const content = params.caption?.trim() || fileName

    try {
      const { error: messageInsertError } = await this.supabase
        .from('messages')
        .insert({
          id: messageId,
          conversation_id: params.roomId,
          user_id: params.userId,
          role: 'user',
          content,
          message_type: 'file',
          status: 'sending',
        })

      if (messageInsertError) throw messageInsertError

      storagePath = `${params.roomId}/${params.userId}/${messageId}/${fileName}`

      const { error: uploadError } = await this.supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .upload(storagePath, params.file, {
          upsert: false,
          contentType: params.file.type || 'application/octet-stream',
        })

      if (uploadError) throw uploadError
      uploaded = true

      const { error: attachmentInsertError } = await this.supabase
        .from('message_attachments')
        .insert({
          message_id: messageId,
          conversation_id: params.roomId,
          user_id: params.userId,
          bucket_id: ATTACHMENTS_BUCKET,
          storage_path: storagePath,
          file_name: fileName,
          mime_type: params.file.type || 'application/octet-stream',
          size_bytes: params.file.size,
        })

      if (attachmentInsertError) throw attachmentInsertError

      const { error: updateMessageError } = await this.supabase
        .from('messages')
        .update({ status: 'sent' })
        .eq('id', messageId)

      if (updateMessageError) throw updateMessageError

      const message = await this.getMessageById(messageId)
      if (!message) throw new Error('Unable to load uploaded file message')
      this.setStatus('connected')
      return message
    } catch (error) {
      if (uploaded && storagePath) {
        await this.supabase.storage.from(ATTACHMENTS_BUCKET).remove([storagePath])
      }

      await this.supabase.from('messages').delete().eq('id', messageId)
      console.error('[SupabaseAgent] File upload failed:', error)
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
        task_data,
        message_attachments (
          id,
          bucket_id,
          storage_path,
          file_name,
          mime_type,
          size_bytes,
          created_at
        )
      `)
      .eq('conversation_id', roomId)
      .order('created_at', { ascending: true })

    if (error) throw error

    const visibleMessages = (data || []).filter((msg: any) => msg.message_type !== 'handover')
    return Promise.all(visibleMessages.map((msg: any) => this.mapDbMessage(msg)))
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
          void this.handleRealtimeInsert(payload.new as any, callback)
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
    lastMessagePreview?: string
    unreadCount?: number
    isOnline?: boolean
  }>> {
    const { data, error } = await this.supabase
      .from('conversations')
      .select('id, title, last_message_at, updated_at, agent_user_id')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) throw error

    const conversationRows = data || []
    const conversationIds = conversationRows.map((conv: any) => conv.id)
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

    let previewByConversationId = new Map<string, DbConversationMessagePreviewRow>()
    let latestAssistantTimestampByConversationId = new Map<string, number>()
    if (conversationRows.length > 0) {
      const { data: messageRows } = await this.supabase
        .from('messages')
        .select('conversation_id, content, created_at, role, message_type')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false })
        .limit(Math.max(conversationRows.length * 20, 60))

      for (const row of (messageRows || []) as DbConversationMessagePreviewRow[]) {
        if (!previewByConversationId.has(row.conversation_id)) {
          previewByConversationId.set(row.conversation_id, row)
        }
        if (row.role === 'assistant' && !latestAssistantTimestampByConversationId.has(row.conversation_id)) {
          latestAssistantTimestampByConversationId.set(row.conversation_id, new Date(row.created_at).getTime())
        }
      }
    }

    const onlineByAgentUserId = new Map<string, boolean>()
    if (agentIds.length > 0) {
      try {
        const { data: observabilityRows } = await this.supabase
          .from('user_observability_services')
          .select('user_id, status, updated_at')
          .in('user_id', agentIds)
          .eq('service_name', 'agent-server')

        for (const row of (observabilityRows || []) as DbObservabilityRow[]) {
          const updatedAt = new Date(row.updated_at).getTime()
          const recentEnough = Date.now() - updatedAt < ONLINE_STALE_AFTER_MS
          if (row.status === 'healthy' && recentEnough) {
            onlineByAgentUserId.set(row.user_id, true)
          } else if (!onlineByAgentUserId.has(row.user_id)) {
            onlineByAgentUserId.set(row.user_id, false)
          }
        }
      } catch {
        // Observability table may not exist in older environments.
      }
    }

    const renderPreview = (preview: DbConversationMessagePreviewRow | undefined): string => {
      if (!preview) return ''
      if (preview.message_type === 'file') return '📎 Arquivo'
      if (preview.message_type === 'task_proposal') return '📋 Aprovação de tarefa'
      if (preview.message_type === 'task_execution') return '⚙️ Execução de tarefa'
      return preview.content || ''
    }

    return conversationRows.map((conv: any) => ({
      id: conv.id,
      title: conv.title,
      lastMessageAt: new Date(conv.last_message_at || conv.updated_at),
      updatedAt: new Date(conv.updated_at),
      agentUserId: conv.agent_user_id,
      agentDisplayName: profileByUserId.get(conv.agent_user_id)?.display_name,
      agentType: profileByUserId.get(conv.agent_user_id)?.user_type,
      lastMessagePreview: renderPreview(previewByConversationId.get(conv.id)),
      unreadCount: 0,
      isOnline: onlineByAgentUserId.has(conv.agent_user_id)
        ? onlineByAgentUserId.get(conv.agent_user_id)
        : (() => {
            const assistantAt = latestAssistantTimestampByConversationId.get(conv.id)
            if (!assistantAt) return false
            return Date.now() - assistantAt < ONLINE_STALE_AFTER_MS
          })(),
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
