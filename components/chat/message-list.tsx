'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, CheckCheck, Download, Paperclip } from 'lucide-react'
import type { Message } from '@/lib/chat/types'
import { TaskApprovalCard } from '@/components/TaskApprovalCard'
import { SkeletonMessage } from '@/components/SkeletonMessage'
import { MessageStatusIndicator } from '@/components/MessageStatusIndicator'
import { MessageStatus } from '@/types/message-status'
import { cn } from '@/lib/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

interface MessageListProps {
  messages: Message[]
  currentUserId: string
  isLoading?: boolean
  streamingStatus?: MessageStatus
  streamingText?: string
  onApproveTask?: (taskId: string, maxCommands: number) => Promise<void>
  onRejectTask?: (taskId: string) => Promise<void>
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function MessageCheckIcon({ status }: { status?: Message['status'] }) {
  if (!status || status === 'sending') {
    return <Check className="h-3.5 w-3.5 text-muted-foreground/50" />
  }
  if (status === 'error') {
    return <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
  }
  if (status === 'sent') {
    return <Check className="h-3.5 w-3.5 text-muted-foreground" />
  }
  if (status === 'delivered') {
    return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />
  }
  return <CheckCheck className="h-3.5 w-3.5 text-primary" />
}

function getDeliveryLabel(status?: Message['status']): string {
  if (!status || status === 'sending') return 'Enviando'
  if (status === 'sent') return 'Enviada'
  if (status === 'delivered') return 'Entregue'
  if (status === 'read') return 'Lida'
  return 'Falha'
}

function getMessageKindLabel(messageType?: Message['message_type']): string | null {
  if (!messageType || messageType === 'message') return null
  if (messageType === 'task_proposal') return 'Aguardando sua aprovação'
  if (messageType === 'task_execution') return 'Execução do agente'
  if (messageType === 'task_approval') return 'Confirmação de aprovação'
  if (messageType === 'file') return 'Arquivo compartilhado'
  return 'Atualização do sistema'
}

function buildTaskSummary(message: Message): string {
  const data = message.task_data
  if (!data) return message.content || 'Sem detalhes da tarefa'
  const steps = (data.steps || []).map((step, index) => `${index + 1}. ${step}`).join('\n')
  return [
    `Tarefa: ${data.title || 'Sem título'}`,
    data.description ? `Descrição: ${data.description}` : null,
    steps ? `Passos:\n${steps}` : null,
    data.estimated_commands ? `Comandos estimados: ${data.estimated_commands}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function getTextForCopy(message: Message): string {
  if (message.message_type === 'task_proposal') return buildTaskSummary(message)
  if (message.content.trim()) return message.content.trim()
  if (message.attachments && message.attachments.length > 0) {
    return message.attachments
      .map((attachment) => attachment.url || attachment.fileName)
      .join('\n')
  }
  return ''
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = size
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export function MessageList({ 
  messages, 
  currentUserId,
  isLoading = false,
  streamingStatus,
  streamingText,
  onApproveTask,
  onRejectTask
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [contextTargetId, setContextTargetId] = useState<string | null>(null)
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: messages.length > 2 ? 'smooth' : 'auto' })
  }, [messages, streamingText])

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    }
  }, [])

  const flashFeedback = useCallback((text: string) => {
    setActionFeedback(text)
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = setTimeout(() => setActionFeedback(null), 2200)
  }, [])

  const handleCopyMessage = useCallback(async (message: Message) => {
    const text = getTextForCopy(message)
    if (!text) {
      flashFeedback('Nada para copiar nesta mensagem.')
      return
    }
    const ok = await copyToClipboard(text)
    flashFeedback(ok ? 'Conteúdo copiado.' : 'Falha ao copiar.')
  }, [flashFeedback])

  const handleForwardLikeCopy = useCallback(async (message: Message) => {
    const text = getTextForCopy(message)
    if (!text) {
      flashFeedback('Nada para encaminhar.')
      return
    }
    const wrapped = `↪ Encaminhado\n${text}`
    const ok = await copyToClipboard(wrapped)
    flashFeedback(ok ? 'Formato de encaminhamento copiado.' : 'Falha ao copiar.')
  }, [flashFeedback])

  const openFirstAttachment = useCallback((message: Message) => {
    const firstAttachment = message.attachments?.find((attachment) => !!attachment.url)
    if (!firstAttachment?.url) {
      flashFeedback('Arquivo sem link disponível.')
      return
    }
    window.open(firstAttachment.url, '_blank', 'noopener,noreferrer')
    flashFeedback('Arquivo aberto em nova aba.')
  }, [flashFeedback])

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto chat-scroll px-4 py-5 md:px-6">
        <div className="mx-auto w-full max-w-4xl flex flex-col gap-3">
          <SkeletonMessage />
          <SkeletonMessage />
        </div>
      </div>
    )
  }

  if (messages.length === 0 && !streamingText) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 md:p-10">
        <p className="text-muted-foreground text-center text-sm">
          Nenhuma mensagem ainda.
          <br />
          Comece a conversa!
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto chat-scroll px-4 py-5 md:px-6">
      <div className="mx-auto w-full max-w-4xl flex flex-col gap-2">
        {messages.map((message, index) => {
          const isOwn = message.userId === currentUserId
          const showAvatar = !isOwn && (
            index === 0 || 
            messages[index - 1].userId !== message.userId
          )
          
          const messageType = message.message_type
          const taskData = message.task_data
          const taskId = message.task_id
          const attachments = message.attachments || []
          const hideRepeatedFileName = messageType === 'file' &&
            attachments.length === 1 &&
            message.content.trim() === attachments[0].fileName
          const shouldShowContent = !!message.content.trim() && !hideRepeatedFileName
          const kindLabel = getMessageKindLabel(messageType)
          
          return (
            <div
              key={message.id}
              className={`flex px-1 ${isOwn ? 'justify-end' : 'justify-start'} ${
                showAvatar ? 'mt-2' : ''
              }`}
            >
              {messageType === 'task_proposal' && taskData && taskId && onApproveTask && onRejectTask ? (
                <ContextMenu onOpenChange={(open) => setContextTargetId(open ? message.id : null)}>
                  <ContextMenuTrigger asChild>
                    <div className={cn(
                      'max-w-[90%] sm:max-w-[84%] transition-transform',
                      contextTargetId === message.id && 'scale-[1.01] drop-shadow-lg'
                    )}>
                      <TaskApprovalCard
                        taskProposal={taskData}
                        taskId={taskId}
                        onApprove={(id, maxCommands) => onApproveTask(id, maxCommands)}
                        onReject={(id) => onRejectTask(id)}
                      />
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuLabel>Ações da tarefa</ContextMenuLabel>
                    <ContextMenuItem onSelect={() => void handleCopyMessage(message)}>
                      Copiar resumo
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => void handleForwardLikeCopy(message)}>
                      Encaminhar (copiar formato)
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => void onApproveTask(taskId, taskData.max_commands ?? taskData.estimated_commands ?? 10)}>
                      Aprovar agora
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => void onRejectTask(taskId)}>
                      Rejeitar agora
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onSelect={async () => {
                        const ok = await copyToClipboard(taskId)
                        flashFeedback(ok ? 'ID da tarefa copiado.' : 'Falha ao copiar ID.')
                      }}
                    >
                      Copiar ID da tarefa
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ) : (
                <ContextMenu onOpenChange={(open) => setContextTargetId(open ? message.id : null)}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={cn(
                        'relative max-w-[90%] sm:max-w-[84%] px-4 py-3 rounded-2xl overflow-hidden transition-transform',
                        isOwn
                          ? 'bg-primary text-primary-foreground rounded-br-md dark:bg-zinc-700 dark:text-zinc-100'
                          : 'bg-card border border-border rounded-bl-md',
                        contextTargetId === message.id && 'scale-[1.01] drop-shadow-lg ring-1 ring-border'
                      )}
                    >
                      {isOwn && message.status === 'sending' && (
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary-foreground/20 dark:bg-zinc-300/25">
                          <div className="h-full w-1/3 bg-primary-foreground/80 dark:bg-zinc-100/90 animate-progress" />
                        </div>
                      )}

                      {kindLabel && (
                        <div className="mb-2">
                          <span className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase',
                            isOwn
                              ? 'bg-primary-foreground/20 text-primary-foreground dark:bg-zinc-200/20 dark:text-zinc-100'
                              : 'bg-muted text-muted-foreground'
                          )}>
                            {kindLabel}
                          </span>
                        </div>
                      )}

                      {attachments.length > 0 && (
                        <div className={shouldShowContent ? 'mb-2' : ''}>
                          {attachments.map((attachment) => (
                            <a
                              key={attachment.id}
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block mb-1 last:mb-0 rounded-xl overflow-hidden border border-white/10 bg-zinc-900 shadow-sm transition-transform duration-200 hover:scale-[1.01]"
                            >
                              <div className="px-2.5 py-2 bg-black flex items-center gap-2 text-white">
                                <Paperclip className="h-4 w-4 shrink-0 text-white/80" />
                                <p className="text-sm font-medium truncate min-w-0">{attachment.fileName}</p>
                                <Download className="h-4 w-4 shrink-0 text-white/80 ml-auto" />
                              </div>
                              <div className="px-2.5 py-1.5 bg-zinc-800 text-zinc-300 text-[11px]">
                                {formatBytes(attachment.sizeBytes)}
                              </div>
                            </a>
                          ))}
                        </div>
                      )}

                      {shouldShowContent && (
                        <p className="text-[15px] leading-[1.6] break-words whitespace-pre-wrap">
                          {message.content}
                        </p>
                      )}
                      <div className={`flex items-center justify-end gap-1 mt-1 ${
                        isOwn ? 'text-primary-foreground/70 dark:text-zinc-200/80' : 'text-muted-foreground'
                      }`}>
                        {isOwn && (
                          <span className="text-[10px] uppercase tracking-wide">
                            {getDeliveryLabel(message.status)}
                          </span>
                        )}
                        <span className="text-[10px]">
                          {formatTime(message.timestamp)}
                        </span>
                        {isOwn && <MessageCheckIcon status={message.status} />}
                      </div>
                      {isOwn && message.status === 'error' && (
                        <p className={cn(
                          'mt-1 text-[11px]',
                          isOwn ? 'text-rose-200' : 'text-rose-500'
                        )}>
                          Falha no envio. Tente novamente.
                        </p>
                      )}
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuLabel>Ações da mensagem</ContextMenuLabel>
                    <ContextMenuItem onSelect={() => void handleCopyMessage(message)}>
                      Copiar mensagem
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => void handleForwardLikeCopy(message)}>
                      Encaminhar (copiar formato)
                    </ContextMenuItem>
                    {attachments.length > 0 && (
                      <ContextMenuItem onSelect={() => openFirstAttachment(message)}>
                        Abrir primeiro arquivo
                      </ContextMenuItem>
                    )}
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onSelect={async () => {
                        const ok = await copyToClipboard(message.id)
                        flashFeedback(ok ? 'ID da mensagem copiado.' : 'Falha ao copiar ID.')
                      }}
                    >
                      Copiar ID da mensagem
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              )}
            </div>
          )
        })}
        
        {streamingText && (
          <div className="flex justify-start mt-2 px-1">
            <div className="relative max-w-[90%] sm:max-w-[84%] px-4 py-3 rounded-2xl bg-card border border-border rounded-bl-md">
              <p className="text-[15px] leading-[1.6] break-words whitespace-pre-wrap">
                {streamingText}
              </p>
              {streamingStatus && (
                <div className="mt-2">
                  <MessageStatusIndicator 
                    status={streamingStatus} 
                    startedAt={Date.now()}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {actionFeedback && (
          <div className="px-1 mt-1">
            <p className="inline-flex rounded-full bg-muted text-muted-foreground text-[11px] px-2.5 py-1">
              {actionFeedback}
            </p>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
