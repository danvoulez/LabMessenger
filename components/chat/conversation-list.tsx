'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { Conversation } from '@/lib/chat/types'

interface ConversationListProps {
  conversations: Conversation[]
  onSelectConversation: (conversation: Conversation) => void
  selectedId?: string
}

function formatTime(timestamp?: number): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } else if (diffDays === 1) {
    return 'Ontem'
  } else if (diffDays < 7) {
    return date.toLocaleDateString('pt-BR', { weekday: 'short' })
  }
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function ConversationList({
  conversations,
  onSelectConversation,
  selectedId
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <p className="text-muted-foreground text-sm">
          Nenhuma conversa ainda.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {conversations.map((conversation) => (
        <button
          key={conversation.id}
          onClick={() => onSelectConversation(conversation)}
          className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent active:bg-accent/80 text-left ${
            selectedId === conversation.id ? 'bg-accent' : ''
          }`}
        >
          <div className="relative shrink-0">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-muted text-muted-foreground text-sm font-medium">
                {getInitials(conversation.name)}
              </AvatarFallback>
            </Avatar>
            {conversation.isOnline && (
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-chat-online border-2 border-card" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground truncate">
                {conversation.name}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatTime(conversation.lastMessageTime)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className="text-sm text-muted-foreground truncate">
                {conversation.lastMessage || 'Nenhuma mensagem'}
              </span>
              {conversation.unreadCount > 0 && (
                <span className="shrink-0 flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                  {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
