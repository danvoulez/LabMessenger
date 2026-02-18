'use client'

import { useEffect, useRef } from 'react'
import { Check, CheckCheck } from 'lucide-react'
import type { Message } from '@/lib/chat/types'
import { TaskApprovalCard } from '@/components/TaskApprovalCard'
import { SkeletonMessage } from '@/components/SkeletonMessage'
import { MessageStatusIndicator } from '@/components/MessageStatusIndicator'
import { MessageStatus } from '@/types/message-status'

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
  if (status === 'sent') {
    return <Check className="h-3.5 w-3.5 text-muted-foreground" />
  }
  if (status === 'delivered') {
    return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />
  }
  return <CheckCheck className="h-3.5 w-3.5 text-primary" />
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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
                  className={`relative max-w-[85%] px-3 py-2 rounded-2xl ${
                    isOwn
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-card border border-border rounded-bl-md'
                  }`}
                >
                  <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                    {message.content}
                  </p>
                  <div className={`flex items-center justify-end gap-1 mt-1 ${
                    isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  }`}>
                    <span className="text-[10px]">
                      {formatTime(message.timestamp)}
                    </span>
                    {isOwn && <MessageCheckIcon status={message.status} />}
                  </div>
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
