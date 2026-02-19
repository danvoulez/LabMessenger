'use client'

import { ChevronLeft, LoaderCircle, MoreVertical, Phone, Video, Wifi, WifiOff } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import type { Conversation } from '@/lib/chat/types'
import type { ConnectionStatus } from '@/lib/chat'
import { cn } from '@/lib/utils'

interface ChatHeaderProps {
  conversation: Conversation
  onBack: () => void
  onOpenProfile?: () => void
  connectionStatus?: ConnectionStatus
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function ConnectionMini({ status = 'disconnected' }: { status?: ConnectionStatus }) {
  if (status === 'connecting') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <LoaderCircle className="h-3 w-3 animate-spin" />
        conectando
      </span>
    )
  }
  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
        <Wifi className="h-3 w-3" />
        conectado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-rose-500">
      <WifiOff className="h-3 w-3" />
      sem conexão
    </span>
  )
}

export function ChatHeader({ conversation, onBack, onOpenProfile, connectionStatus }: ChatHeaderProps) {
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
          <span
            className={cn(
              'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card shadow-[0_0_10px_currentColor]',
              conversation.isOnline
                ? 'bg-emerald-400 text-emerald-400 signal-online'
                : 'bg-rose-400 text-rose-400 signal-offline'
            )}
          />
        </div>

        <div className="min-w-0">
          <h1 className="font-semibold text-foreground truncate leading-tight">
            {conversation.name}
          </h1>
          <div className="flex items-center gap-2">
            <p className={cn(
              'text-xs',
              conversation.isOnline ? 'text-emerald-600' : 'text-rose-500'
            )}>
              {conversation.isOnline ? 'Online' : 'Offline'}
            </p>
            <span className="text-muted-foreground/60">•</span>
            <ConnectionMini status={connectionStatus} />
          </div>
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
