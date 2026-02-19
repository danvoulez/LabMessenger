'use client'

import { ChevronLeft, MoreVertical, Phone, Video } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import type { Conversation } from '@/lib/chat/types'

interface ChatHeaderProps {
  conversation: Conversation
  onBack: () => void
  onOpenProfile?: () => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function ChatHeader({ conversation, onBack, onOpenProfile }: ChatHeaderProps) {
  return (
    <header className="safe-top safe-x sticky top-0 z-10 flex items-center gap-2 px-2 py-2 bg-card border-b border-border">
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="shrink-0 h-10 w-10 rounded-full"
        aria-label="Voltar"
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>
      
      <button
        type="button"
        className="flex items-center gap-2 min-w-0 flex-1 text-left"
        onClick={onOpenProfile}
        disabled={!onOpenProfile}
        aria-label="Abrir perfil do contato"
      >
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-muted text-muted-foreground text-sm font-medium">
              {getInitials(conversation.name)}
            </AvatarFallback>
          </Avatar>
          {conversation.isOnline && (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-chat-online border-2 border-card" />
          )}
        </div>

        <div className="min-w-0">
          <h1 className="font-semibold text-foreground truncate leading-tight">
            {conversation.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            {conversation.isOnline ? 'Online' : 'Offline'}
          </p>
        </div>
      </button>
      
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Chamada de voz"
        >
          <Phone className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Chamada de vídeo"
        >
          <Video className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Mais opções"
          onClick={onOpenProfile}
          disabled={!onOpenProfile}
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}
