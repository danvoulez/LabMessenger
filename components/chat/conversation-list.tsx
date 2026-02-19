'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { Conversation } from '@/lib/chat/types'

interface ConversationListProps {
  conversations: Conversation[]
  onSelectConversation: (conversation: Conversation) => void
  selectedId?: string
  theme?: 'light' | 'dark'
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
  selectedId,
  theme = 'light',
}: ConversationListProps) {
  const isDark = theme === 'dark'

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <p className={cn('text-sm', isDark ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
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
          className={cn(
            'flex items-center gap-3 px-4 py-3 transition-all duration-200 text-left',
            isDark
              ? 'hover:bg-primary-foreground/10 active:bg-primary-foreground/15 border-b border-primary-foreground/10'
              : 'hover:bg-accent active:bg-accent/80',
            selectedId === conversation.id && (isDark ? 'bg-primary-foreground/14' : 'bg-accent')
          )}
        >
          <div className="relative shrink-0">
            <Avatar className="h-12 w-12">
              <AvatarFallback className={cn(
                'text-sm font-medium',
                isDark ? 'bg-primary-foreground/12 text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}>
                {getInitials(conversation.name)}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 shadow-[0_0_10px_currentColor] transition-colors',
                isDark ? 'border-primary' : 'border-card',
                conversation.isOnline
                  ? 'bg-emerald-400 text-emerald-400 signal-online'
                  : 'bg-rose-400 text-rose-400 signal-offline'
              )}
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={cn('font-medium truncate', isDark ? 'text-primary-foreground' : 'text-foreground')}>
                {conversation.name}
              </span>
              <span className={cn('text-xs shrink-0', isDark ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                {formatTime(conversation.lastMessageTime)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className={cn('text-sm truncate', isDark ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                {conversation.lastMessage || 'Nenhuma mensagem'}
              </span>
              {conversation.unreadCount > 0 && (
                <span className={cn(
                  'shrink-0 flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-xs font-medium',
                  isDark ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground'
                )}>
                  {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                </span>
              )}
            </div>
            <div className="mt-1">
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] border',
                conversation.isOnline
                  ? (isDark ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10' : 'text-emerald-700 border-emerald-500/30 bg-emerald-500/10')
                  : (isDark ? 'text-rose-300 border-rose-400/40 bg-rose-500/10' : 'text-rose-700 border-rose-500/30 bg-rose-500/10')
              )}>
                <span className={cn('h-1.5 w-1.5 rounded-full', conversation.isOnline ? 'bg-emerald-400' : 'bg-rose-400')} />
                {conversation.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
