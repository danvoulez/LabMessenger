'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  AppHeader,
  ConversationList,
  ChatHeader,
  MessageList,
  MessageInput,
} from '@/components/chat'
import type { Conversation, Message } from '@/lib/chat/types'
import { useAuth } from '@/hooks/use-auth'
import { chatProvider } from '@/lib/chat'

export default function ChatApp() {
  const router = useRouter()
  const { user, isLoading, isAuthenticated, signOut } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(true)

  const currentUserId = user?.id ?? ''
  const currentUsername = user?.username || user?.email?.split('@')[0] || 'Você'

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router])

  // Load real conversations from Supabase
  useEffect(() => {
    if (!isAuthenticated || !currentUserId) return

    setConversationsLoading(true)
    chatProvider.getConversations(currentUserId)
      .then((data) => {
        const mapped: Conversation[] = data.map(c => ({
          id: c.id,
          name: c.agentDisplayName || c.title,
          lastMessage: '',
          lastMessageTime: c.lastMessageAt.getTime(),
          unreadCount: 0,
          isOnline: false,
          participantUserId: c.agentUserId,
          participantType: c.agentType,
        }))
        setConversations(mapped)
      })
      .catch(console.error)
      .finally(() => setConversationsLoading(false))
  }, [isAuthenticated, currentUserId])

  // Load messages when a conversation is selected
  useEffect(() => {
    if (!selectedConversation) {
      setMessages([])
      return
    }

    chatProvider.getMessages(selectedConversation.id)
      .then(setMessages)
      .catch(console.error)

    const unsubscribe = chatProvider.subscribe(selectedConversation.id, (newMsg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev
        return [...prev, newMsg]
      })
    })

    return unsubscribe
  }, [selectedConversation])

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

  const handleOpenConversationProfile = useCallback(() => {
    if (!selectedConversation?.participantUserId) return
    router.push(`/profile/${selectedConversation.participantUserId}`)
  }, [router, selectedConversation])

  const handleSelectConversation = useCallback((conversation: Conversation) => {
    setSelectedConversation(conversation)
  }, [])

  const handleBack = useCallback(() => {
    setSelectedConversation(null)
  }, [])

  const handleSendMessage = useCallback(async (content: string) => {
    if (!selectedConversation || !currentUserId) return

    await chatProvider.sendMessage({
      content,
      userId: currentUserId,
      username: currentUsername,
      roomId: selectedConversation.id,
    })
  }, [selectedConversation, currentUserId, currentUsername])

  // Task approval — sends "APPROVED:<taskId>:<maxCommands>" as a message to the agent
  const handleApproveTask = useCallback(async (taskId: string, maxCommands: number) => {
    if (!selectedConversation || !currentUserId) return
    await chatProvider.sendMessage({
      content: `APPROVED:${taskId}:${maxCommands}`,
      userId: currentUserId,
      username: currentUsername,
      roomId: selectedConversation.id,
    })
  }, [selectedConversation, currentUserId, currentUsername])

  // Task rejection — sends "REJECTED:<taskId>" as a message to the agent
  const handleRejectTask = useCallback(async (taskId: string) => {
    if (!selectedConversation || !currentUserId) return
    await chatProvider.sendMessage({
      content: `REJECTED:${taskId}`,
      userId: currentUserId,
      username: currentUsername,
      roomId: selectedConversation.id,
    })
  }, [selectedConversation, currentUserId, currentUsername])

  if (isLoading) {
    return (
      <main className="flex items-center justify-center h-dvh bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </main>
    )
  }

  if (!selectedConversation) {
    return (
      <main className="flex flex-col h-dvh bg-background">
        <AppHeader
          title="Conversas"
          onLogout={handleLogout}
          userName={currentUsername}
          onOpenProfile={handleOpenProfile}
          onOpenTasks={handleOpenTasks}
        />
        <div className="safe-bottom flex-1 overflow-y-auto">
          {conversationsLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Carregando conversas...
            </div>
          ) : (
            <ConversationList
              conversations={conversations}
              onSelectConversation={handleSelectConversation}
            />
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-col h-dvh bg-background page-transition">
      <ChatHeader
        conversation={selectedConversation}
        onBack={handleBack}
        onOpenProfile={handleOpenConversationProfile}
      />
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        onApproveTask={handleApproveTask}
        onRejectTask={handleRejectTask}
      />
      <MessageInput onSend={handleSendMessage} />
    </main>
  )
}
