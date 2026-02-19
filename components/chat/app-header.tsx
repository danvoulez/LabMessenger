'use client'

import { MoreVertical, LogOut, User, ListTodo } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
}

export function AppHeader({ title, userName, onLogout, onOpenProfile, onOpenTasks }: AppHeaderProps) {
  return (
    <header className="safe-top safe-x sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-card border-b border-border">
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
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
