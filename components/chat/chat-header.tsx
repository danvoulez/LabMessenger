'use client'

import type { ReactNode } from 'react'
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

function getAvailability(
  isAgentOnline: boolean,
  connectionStatus: ConnectionStatus = 'disconnected'
): { label: string; toneClass: string; icon: ReactNode } {
  if (connectionStatus === 'connecting') {
    return {
      label: 'Reconectando chat...',
      toneClass: 'text-amber-700 dark:text-amber-300',
      icon: <LoaderCircle className="h-3 w-3 animate-spin" />,
    }
  }
  if (connectionStatus === 'error' || connectionStatus === 'disconnected') {
    return {
      label: 'Sem conexão com mensagens',
      toneClass: 'text-rose-700 dark:text-rose-300',
      icon: <WifiOff className="h-3 w-3" />,
    }
  }
  if (isAgentOnline) {
    return {
      label: 'Conectado: responde agora',
      toneClass: 'text-emerald-700 dark:text-emerald-300',
      icon: <Wifi className="h-3 w-3" />,
    }
  }
  return {
    label: 'Indisponível agora',
    toneClass: 'text-rose-600 dark:text-rose-300',
    icon: <WifiOff className="h-3 w-3" />,
  }
}

export function ChatHeader({ conversation, onBack, onOpenProfile, connectionStatus }: ChatHeaderProps) {
  const availability = getAvailability(conversation.isOnline ?? false, connectionStatus)

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
        <div className="shrink-0">
          <Avatar className="h-10 w-10 border border-border/60">
            <AvatarFallback className="bg-muted text-muted-foreground text-sm font-medium">
              {getInitials(conversation.name)}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="min-w-0">
          <h1 className="font-semibold text-foreground truncate leading-tight">
            {conversation.name}
          </h1>
          <div className={cn('inline-flex items-center gap-1.5 text-xs', availability.toneClass)}>
            {availability.icon}
            <span>{availability.label}</span>
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
