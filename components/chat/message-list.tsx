'use client'

import { useEffect, useRef } from 'react'
import { AlertCircle, Check, CheckCheck, Download, Paperclip } from 'lucide-react'
import type { Message } from '@/lib/chat/types'
import { TaskApprovalCard } from '@/components/TaskApprovalCard'
import { SkeletonMessage } from '@/components/SkeletonMessage'
import { MessageStatusIndicator } from '@/components/MessageStatusIndicator'
import { MessageStatus } from '@/types/message-status'
import { cn } from '@/lib/utils'

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: messages.length > 2 ? 'smooth' : 'auto' })
  }, [messages, streamingText])

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto chat-scroll px-3 py-4">
        <div className="flex flex-col gap-3">
          <SkeletonMessage />
          <SkeletonMessage />
        </div>
      </div>
    )
  }

  if (messages.length === 0 && !streamingText) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-muted-foreground text-center text-sm">
          Nenhuma mensagem ainda.
          <br />
          Comece a conversa!
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto chat-scroll px-3 py-4">
      <div className="flex flex-col gap-1">
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
          
          return (
            <div
              key={message.id}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${
                showAvatar ? 'mt-2' : ''
              }`}
            >
              {/* Task Approval Card */}
              {messageType === 'task_proposal' && taskData && taskId && onApproveTask && onRejectTask ? (
                <div className="max-w-[85%]">
                  <TaskApprovalCard
                    taskProposal={taskData}
                    taskId={taskId}
                    onApprove={(id, maxCommands) => onApproveTask(id, maxCommands)}
                    onReject={(id) => onRejectTask(id)}
                  />
                </div>
              ) : (
                /* Regular Message */
                <div
                  className={`relative max-w-[85%] px-3 py-2 rounded-2xl overflow-hidden ${
                    isOwn
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-card border border-border rounded-bl-md'
                  }`}
                >
                  {isOwn && message.status === 'sending' && (
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary-foreground/20">
                      <div className="h-full w-1/3 bg-primary-foreground/80 animate-progress" />
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
                    <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                      {message.content}
                    </p>
                  )}
                  <div className={`flex items-center justify-end gap-1 mt-1 ${
                    isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  }`}>
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
              )}
            </div>
          )
        })}
        
        {/* Streaming message (aparece enquanto agent está processando) */}
        {streamingText && (
          <div className="flex justify-start mt-2">
            <div className="relative max-w-[85%] px-3 py-2 rounded-2xl bg-card border border-border rounded-bl-md">
              <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
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
        
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
