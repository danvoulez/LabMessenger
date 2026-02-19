'use client'

import React from "react"

import { useState, useRef, useEffect } from 'react'
import { LoaderCircle, Paperclip, Send, Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePrefetch } from '@/hooks/usePrefetch'

interface MessageInputProps {
  onSend: (content: string) => Promise<void> | void
  onSendAttachment?: (file: File) => Promise<void>
  disabled?: boolean
  placeholder?: string
  agentUrl?: string
}

export function MessageInput({ 
  onSend, 
  onSendAttachment,
  disabled = false,
  placeholder = 'Mensagem',
  agentUrl
}: MessageInputProps) {
  const [content, setContent] = useState('')
  const [isSendingText, setIsSendingText] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [visualProgress, setVisualProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  
  // ⚡ Prefetch: pré-aquece conexões ao começar a digitar
  const { onUserStartTyping } = usePrefetch({ 
    agentUrl, 
    enabled: !!agentUrl 
  })

  const startVisualProgress = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    setVisualProgress(4)
    progressIntervalRef.current = setInterval(() => {
      setVisualProgress((prev) => Math.min(94, prev + (prev < 40 ? 8 : prev < 75 ? 4 : 2)))
    }, 120)
  }

  const finishVisualProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    setVisualProgress(100)
    window.setTimeout(() => setVisualProgress(0), 220)
  }

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if (trimmed && !disabled && !isUploading && !isSendingText) {
      setSendError(null)
      setIsSendingText(true)
      startVisualProgress()

      try {
        await onSend(trimmed)
        setContent('')
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
        }
      } catch (error) {
        const fallback = 'Falha ao enviar mensagem. Tente novamente.'
        const message = error instanceof Error && error.message ? error.message : fallback
        setSendError(message)
      } finally {
        finishVisualProgress()
        window.setTimeout(() => setIsSendingText(false), 120)
      }
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !onSendAttachment || disabled || isUploading) return

    setUploadError(null)
    setIsUploading(true)
    startVisualProgress()

    try {
      await onSendAttachment(file)
    } catch (error) {
      const fallback = 'Falha no upload do arquivo. Tente novamente.'
      const message = error instanceof Error && error.message ? error.message : fallback
      setUploadError(message)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      finishVisualProgress()
    }
  }

  const handleOpenFilePicker = () => {
    if (!onSendAttachment || disabled || isUploading || isSendingText) return
    fileInputRef.current?.click()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [content])

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [])

  const hasContent = content.trim().length > 0
  const busy = isUploading || isSendingText

  return (
    <div className="safe-bottom safe-x sticky bottom-0 bg-background border-t border-border px-3 py-2">
      <div className="h-[2px] w-full overflow-hidden rounded-full bg-muted/70 mb-2">
        <div
          className={cn(
            'h-full bg-primary transition-[width] duration-150',
            busy && visualProgress < 5 && 'animate-progress'
          )}
          style={{ width: `${visualProgress}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          disabled={disabled || busy}
          accept="image/*,video/*,audio/*,.pdf,.txt,.md,.json,.csv,.zip"
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Anexar arquivo"
          onClick={handleOpenFilePicker}
          disabled={!onSendAttachment || disabled || busy}
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        
        <div className="flex-1 flex items-end gap-2 bg-input rounded-3xl px-4 py-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground -ml-2"
            aria-label="Emoji"
          >
            <Smile className="h-5 w-5" />
          </Button>
          
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onInput={onUserStartTyping}
            onKeyDown={handleKeyDown}
            placeholder={isUploading ? 'Enviando arquivo...' : isSendingText ? 'Enviando mensagem...' : placeholder}
            disabled={disabled || isUploading}
            rows={1}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none text-[16px] leading-relaxed max-h-[120px] py-1"
          />
        </div>
        
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !hasContent || busy}
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full"
          aria-label="Enviar mensagem"
        >
          {isSendingText ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </Button>
      </div>
      {uploadError && (
        <p className="mt-2 text-xs text-destructive">{uploadError}</p>
      )}
      {sendError && (
        <p className="mt-2 text-xs text-destructive">{sendError}</p>
      )}
      {busy && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {isUploading ? 'Processando upload...' : 'Enviando mensagem...'}
        </p>
      )}
    </div>
  )
}
