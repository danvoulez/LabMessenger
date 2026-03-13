'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  AppHeader,
  ConversationList,
  ChatHeader,
  MessageList,
  MessageInput,
} from '@/components/chat'
import type { Conversation, Message } from '@/lib/chat/types'
import { chatProvider, type ConnectionStatus } from '@/lib/chat'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

function toConversationPreview(message: Message): string {
  if (message.attachments && message.attachments.length > 0) {
    const firstAttachment = message.attachments[0]
    return `📎 ${firstAttachment.fileName}`
  }
  if (message.message_type === 'task_proposal') return '📋 Aprovação de tarefa'
  if (message.message_type === 'task_execution') return '⚙️ Execução de tarefa'
  return message.content || ''
}

export default function ChatApp() {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const { user, isLoading, isAuthenticated, signOut } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [themeMounted, setThemeMounted] = useState(false)

  const currentUserId = user?.id ?? ''
  const currentUsername = user?.username || user?.email?.split('@')[0] || 'Você'
  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  )
  const isDarkMode = (resolvedTheme ?? 'light') === 'dark'
  const activeTheme = isDarkMode ? 'dark' : 'light'

  const updateConversationFromMessage = useCallback((message: Message) => {
    setConversations((prev) => {
      const next = prev.map((conversation) => {
        if (conversation.id !== message.roomId) return conversation
        const incomingFromAgent = message.userId === conversation.participantUserId
        return {
          ...conversation,
          lastMessage: toConversationPreview(message),
          lastMessageTime: message.timestamp,
          isOnline: incomingFromAgent ? true : conversation.isOnline,
        }
      })
      return [...next].sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0))
    })
  }, [])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (!isAuthenticated) return
    const unsubscribe = chatProvider.onConnectionChange(setConnectionStatus)
    return unsubscribe
  }, [isAuthenticated])

  useEffect(() => {
    setThemeMounted(true)
  }, [])

  // Load conversations from Supabase
  useEffect(() => {
    if (!isAuthenticated || !currentUserId) return

    setConversationsLoading(true)
    chatProvider.getConversations(currentUserId)
      .then((data) => {
        const mapped: Conversation[] = data.map(c => ({
          id: c.id,
          name: c.agentDisplayName || c.title,
          lastMessage: c.lastMessagePreview || '',
          lastMessageTime: c.lastMessageAt.getTime(),
          unreadCount: c.unreadCount ?? 0,
          isOnline: c.isOnline ?? false,
          participantUserId: c.agentUserId,
          participantType: c.agentType,
        }))
        setConversations(mapped)
        setSelectedConversationId((prev) => {
          if (!prev) return null
          return mapped.some((conversation) => conversation.id === prev) ? prev : null
        })
      })
      .catch(console.error)
      .finally(() => setConversationsLoading(false))
  }, [isAuthenticated, currentUserId])

  // Load messages when a conversation is selected
  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([])
      return
    }

    setMessagesLoading(true)
    chatProvider.getMessages(selectedConversationId)
      .then((loadedMessages) => {
        setMessages(loadedMessages)
      })
      .catch(console.error)
      .finally(() => setMessagesLoading(false))

    const unsubscribe = chatProvider.subscribe(selectedConversationId, (newMsg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev
        return [...prev, newMsg]
      })
      updateConversationFromMessage(newMsg)
    })

    return unsubscribe
  }, [selectedConversationId, updateConversationFromMessage])

  const handleLogout = useCallback(async () => {
    await signOut()
    router.push('/login')
  }, [signOut, router])

  const handleOpenTasks = useCallback(() => {
    router.push('/tasks')
  }, [router])

  const handleOpenProfile = useCallback(() => {
    if (!currentUserId) return
    router.push(`/profile/${currentUserId}`)
  }, [router, currentUserId])

  const handleToggleTheme = useCallback(() => {
    setTheme(isDarkMode ? 'light' : 'dark')
  }, [isDarkMode, setTheme])

  const handleOpenConversationProfile = useCallback(() => {
    if (!selectedConversation?.participantUserId) return
    const params = new URLSearchParams()
    params.set('conversationId', selectedConversation.id)
    router.push(`/profile/${selectedConversation.participantUserId}?${params.toString()}`)
  }, [router, selectedConversation])

  const handleSelectConversation = useCallback((conversation: Conversation) => {
    setSelectedConversationId(conversation.id)
  }, [])

  const handleBack = useCallback(() => {
    setSelectedConversationId(null)
  }, [])

  const handleSendMessage = useCallback(async (content: string) => {
    if (!selectedConversationId || !currentUserId) return

    const optimisticId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const optimisticMessage: Message = {
      id: optimisticId,
      content,
      userId: currentUserId,
      username: currentUsername,
      roomId: selectedConversationId,
      timestamp: Date.now(),
      status: 'sending',
      message_type: 'message',
    }

    setMessages((prev) => [...prev, optimisticMessage])
    updateConversationFromMessage(optimisticMessage)

    try {
      const sentMessage = await chatProvider.sendMessage({
        content,
        userId: currentUserId,
        username: currentUsername,
        roomId: selectedConversationId,
      })

      setMessages((prev) => {
        const withoutOptimistic = prev.filter((message) => message.id !== optimisticId)
        if (withoutOptimistic.some((message) => message.id === sentMessage.id)) return withoutOptimistic
        return [...withoutOptimistic, sentMessage]
      })
      updateConversationFromMessage(sentMessage)
    } catch (error) {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === optimisticId ? { ...message, status: 'error' } : message
        )
      )
      throw error
    }
  }, [selectedConversationId, currentUserId, currentUsername, updateConversationFromMessage])

  const handleSendAttachment = useCallback(async (file: File) => {
    if (!selectedConversationId || !currentUserId) return
    if (!chatProvider.sendAttachment) {
      throw new Error('Attachment upload is not available in the current provider')
    }

    const sentMessage = await chatProvider.sendAttachment({
      file,
      userId: currentUserId,
      username: currentUsername,
      roomId: selectedConversationId,
    })

    setMessages((prev) => {
      if (prev.some((message) => message.id === sentMessage.id)) return prev
      return [...prev, sentMessage]
    })
    updateConversationFromMessage(sentMessage)
  }, [selectedConversationId, currentUserId, currentUsername, updateConversationFromMessage])

  // Task approval — prefer secure RPC, fallback to legacy approval message.
  const handleApproveTask = useCallback(async (taskId: string, maxCommands: number) => {
    if (!selectedConversationId || !currentUserId) return
    if (chatProvider.approveTask) {
      await chatProvider.approveTask(selectedConversationId, taskId, currentUserId, maxCommands)
      return
    }
    await chatProvider.sendMessage({
      content: `APPROVED:${taskId}:${maxCommands}`,
      userId: currentUserId,
      username: currentUsername,
      roomId: selectedConversationId,
    })
  }, [selectedConversationId, currentUserId, currentUsername])

  // Task rejection — prefer secure RPC, fallback to legacy rejection message.
  const handleRejectTask = useCallback(async (taskId: string) => {
    if (!selectedConversationId || !currentUserId) return
    if (chatProvider.rejectTask) {
      await chatProvider.rejectTask(selectedConversationId, taskId, currentUserId)
      return
    }
    await chatProvider.sendMessage({
      content: `REJECTED:${taskId}`,
      userId: currentUserId,
      username: currentUsername,
      roomId: selectedConversationId,
    })
  }, [selectedConversationId, currentUserId, currentUsername])

  if (isLoading) {
    return (
      <main className="flex items-center justify-center h-dvh bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </main>
    )
  }

  const conversationPanel = (
    <div className={cn(
      'flex flex-col h-full',
      activeTheme === 'dark' ? 'bg-zinc-900 text-zinc-100' : 'bg-card text-foreground'
    )}>
      <AppHeader
        title="Conversas"
        onLogout={handleLogout}
        userName={currentUsername}
        onOpenProfile={handleOpenProfile}
        onOpenTasks={handleOpenTasks}
        connectionStatus={connectionStatus}
        onToggleTheme={themeMounted ? handleToggleTheme : undefined}
        isDarkMode={isDarkMode}
        theme={activeTheme}
      />
      <div className="safe-bottom flex-1 overflow-y-auto">
        {conversationsLoading ? (
          <div className={cn(
            'flex items-center justify-center h-full',
            activeTheme === 'dark' ? 'text-white/70' : 'text-muted-foreground'
          )}>
            Carregando conversas...
          </div>
        ) : (
          <ConversationList
            conversations={conversations}
            onSelectConversation={handleSelectConversation}
            selectedId={selectedConversationId ?? undefined}
            theme={activeTheme}
          />
        )}
      </div>
    </div>
  )

  const chatPanel = selectedConversation ? (
    <div className="flex flex-col h-full bg-background page-transition">
      <ChatHeader
        conversation={selectedConversation}
        onBack={handleBack}
        onOpenProfile={handleOpenConversationProfile}
        connectionStatus={connectionStatus}
      />
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        isLoading={messagesLoading}
        onApproveTask={handleApproveTask}
        onRejectTask={handleRejectTask}
      />
      <MessageInput onSend={handleSendMessage} onSendAttachment={handleSendAttachment} />
    </div>
  ) : (
    <div className="hidden md:flex h-full items-center justify-center bg-background">
      <div className="text-center text-muted-foreground">
        <p className="text-sm">Selecione uma conversa no painel esquerdo.</p>
      </div>
    </div>
  )

  return (
    <main className="h-dvh bg-background md:grid md:grid-cols-[340px_1fr]">
      <section className={`${selectedConversation ? 'hidden md:block' : 'block'} h-full border-r border-border`}>
        {conversationPanel}
      </section>
      <section className={`${selectedConversation ? 'block' : 'hidden md:block'} h-full`}>
        {chatPanel}
      </section>
    </main>
  )
}
