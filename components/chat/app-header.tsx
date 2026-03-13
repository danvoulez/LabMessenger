'use client'

import { MoreVertical, LogOut, User, ListTodo, AlertTriangle, LoaderCircle, Wifi, WifiOff, Moon, Sun } from 'lucide-react'
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
  onToggleTheme?: () => void
  isDarkMode?: boolean
  theme?: 'light' | 'dark'
}

function ConnectionBadge({ status = 'disconnected', theme = 'light' }: { status?: ConnectionStatus; theme?: 'light' | 'dark' }) {
  if (status === 'connecting') {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] border',
        theme === 'dark'
          ? 'border-white/20 text-white/80 bg-white/5'
          : 'border-border text-muted-foreground bg-muted/70'
      )}>
        <LoaderCircle className="h-3 w-3 animate-spin" />
        Conectando chat
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
        Canal OK
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
        Falha de conexão
      </span>
    )
  }
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] border',
      theme === 'dark'
        ? 'border-white/20 text-white/80 bg-white/5'
        : 'border-border text-muted-foreground bg-muted/70'
      )}>
        <WifiOff className="h-3 w-3" />
      Sem conexão
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
  onToggleTheme,
  isDarkMode = false,
  theme = 'light',
}: AppHeaderProps) {
  const isDark = theme === 'dark'

  return (
    <header className={cn(
      'safe-top safe-x sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b',
      isDark
        ? 'bg-zinc-900 border-white/10'
        : 'bg-card border-border'
    )}>
      <div className="min-w-0 pl-1">
        <h1 className={cn('text-xl font-semibold truncate', isDark ? 'text-white' : 'text-foreground')}>{title}</h1>
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
                ? 'text-white/70 hover:text-white hover:bg-white/10'
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
              <span>Perfil</span>
            </DropdownMenuItem>
          )}
          {onOpenTasks && (
            <DropdownMenuItem onClick={onOpenTasks} className="flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              <span>Tarefas</span>
            </DropdownMenuItem>
          )}
          {onToggleTheme && (
            <DropdownMenuItem onClick={onToggleTheme} className="flex items-center gap-2">
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span>{isDarkMode ? 'Modo claro' : 'Modo escuro'}</span>
            </DropdownMenuItem>
          )}
          {(onOpenProfile || onOpenTasks || onToggleTheme) && onLogout && <DropdownMenuSeparator />}
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
