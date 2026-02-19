'use client'

import { MoreVertical, LogOut, User, ListTodo, AlertTriangle, LoaderCircle, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ConnectionStatus } from '@/lib/chat'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface AppHeaderProps {
  title: string
  userName?: string
  onLogout?: () => void
  onOpenProfile?: () => void
  onOpenTasks?: () => void
  connectionStatus?: ConnectionStatus
  theme?: 'light' | 'dark'
}

function ConnectionBadge({ status = 'disconnected', theme = 'light' }: { status?: ConnectionStatus; theme?: 'light' | 'dark' }) {
  if (status === 'connecting') {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] border',
        theme === 'dark'
          ? 'border-primary-foreground/25 text-primary-foreground/80 bg-primary-foreground/8'
          : 'border-border text-muted-foreground bg-muted/70'
      )}>
        <LoaderCircle className="h-3 w-3 animate-spin" />
        Conectando
      </span>
    )
  }
  if (status === 'connected') {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] border',
        theme === 'dark'
          ? 'border-emerald-400/40 text-emerald-300 bg-emerald-400/10'
          : 'border-emerald-500/30 text-emerald-700 bg-emerald-500/10'
      )}>
        <Wifi className="h-3 w-3" />
        Online
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] border',
        theme === 'dark'
          ? 'border-rose-400/40 text-rose-300 bg-rose-500/10'
          : 'border-rose-500/30 text-rose-700 bg-rose-500/10'
      )}>
        <AlertTriangle className="h-3 w-3" />
        Erro
      </span>
    )
  }
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] border',
      theme === 'dark'
        ? 'border-primary-foreground/25 text-primary-foreground/80 bg-primary-foreground/8'
        : 'border-border text-muted-foreground bg-muted/70'
    )}>
      <WifiOff className="h-3 w-3" />
      Offline
    </span>
  )
}

export function AppHeader({
  title,
  userName,
  onLogout,
  onOpenProfile,
  onOpenTasks,
  connectionStatus,
  theme = 'light',
}: AppHeaderProps) {
  const isDark = theme === 'dark'

  return (
    <header className={cn(
      'safe-top safe-x sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b',
      isDark
        ? 'bg-primary border-primary-foreground/12'
        : 'bg-card border-border'
    )}>
      <div className="min-w-0">
        <h1 className={cn('text-xl font-semibold truncate', isDark ? 'text-primary-foreground' : 'text-foreground')}>{title}</h1>
        <div className="mt-1">
          <ConnectionBadge status={connectionStatus} theme={theme} />
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-10 w-10 rounded-full',
              isDark
                ? 'text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label="Mais opções"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {userName && (
            <>
              <DropdownMenuItem disabled className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="truncate">{userName}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {onOpenProfile && (
            <DropdownMenuItem onClick={onOpenProfile} className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
          )}
          {onOpenTasks && (
            <DropdownMenuItem onClick={onOpenTasks} className="flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              <span>Tasks</span>
            </DropdownMenuItem>
          )}
          {(onOpenProfile || onOpenTasks) && onLogout && <DropdownMenuSeparator />}
          {onLogout && (
            <DropdownMenuItem
              onClick={onLogout}
              className="flex items-center gap-2 text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
