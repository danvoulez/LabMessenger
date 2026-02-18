import React, { useEffect, useState } from 'react'
import { MessageStatus, MESSAGE_STATUS_LABELS, MESSAGE_STATUS_ICONS } from '@/types/message-status'

interface MessageStatusIndicatorProps {
  status: MessageStatus
  startedAt?: number
  className?: string
}

/**
 * Componente que mostra status visual de processamento da mensagem
 * com timer animado para estados longos
 */
export function MessageStatusIndicator({
  status,
  startedAt,
  className = ''
}: MessageStatusIndicatorProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Timer para estados longos (thinking, executing, analyzing)
  useEffect(() => {
    if (!startedAt) return

    const shouldShowTimer = [
      MessageStatus.AGENT_THINKING,
      MessageStatus.EXECUTING,
      MessageStatus.ANALYZING
    ].includes(status)

    if (!shouldShowTimer) return

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      setElapsedSeconds(elapsed)
    }, 100)

    return () => clearInterval(interval)
  }, [status, startedAt])

  // Não mostra nada se completo
  if (status === MessageStatus.COMPLETE) {
    return null
  }

  const label = MESSAGE_STATUS_LABELS[status]
  const icon = MESSAGE_STATUS_ICONS[status]
  const showTimer = elapsedSeconds > 0

  return (
    <div
      className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* Spinner animado */}
      <div className="relative flex h-4 w-4 items-center justify-center">
        {status === MessageStatus.ERROR ? (
          <span className="text-destructive">{icon}</span>
        ) : (
          <>
            <div className="absolute h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
            <span className="absolute text-xs">{icon}</span>
          </>
        )}
      </div>

      {/* Label do status */}
      <span className="font-medium">{label}</span>

      {/* Timer (só para estados longos) */}
      {showTimer && (
        <span className="text-xs opacity-60 tabular-nums">
          {elapsedSeconds}s
        </span>
      )}

      {/* Barra de progresso indeterminada (opcional) */}
      {status === MessageStatus.AGENT_THINKING && (
        <div className="ml-2 h-1 w-16 overflow-hidden rounded-full bg-border">
          <div className="h-full w-1/2 animate-progress bg-primary" />
        </div>
      )}
    </div>
  )
}

/**
 * Versão compacta para inline em mensagens
 */
export function MessageStatusBadge({
  status,
  className = ''
}: { status: MessageStatus; className?: string }) {
  if (status === MessageStatus.COMPLETE) return null

  const icon = MESSAGE_STATUS_ICONS[status]
  const label = MESSAGE_STATUS_LABELS[status]

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs ${className}`}
      title={label}
    >
      <span className="animate-pulse">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </span>
  )
}
