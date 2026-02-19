'use client'

import React from "react"

import { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePrefetch } from '@/hooks/usePrefetch'

interface MessageInputProps {
  onSend: (content: string) => void
  disabled?: boolean
  placeholder?: string
  agentUrl?: string
}

export function MessageInput({ 
  onSend, 
  disabled = false,
  placeholder = 'Mensagem',
  agentUrl
}: MessageInputProps) {
  const [content, setContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // ⚡ Prefetch: pré-aquece conexões ao começar a digitar
  const { onUserStartTyping } = usePrefetch({ 
    agentUrl, 
    enabled: !!agentUrl 
  })

  const handleSubmit = () => {
    const trimmed = content.trim()
    if (trimmed && !disabled) {
      onSend(trimmed)
      setContent('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
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

  const hasContent = content.trim().length > 0

  return (
    <div className="safe-bottom safe-x sticky bottom-0 bg-background border-t border-border px-3 py-2">
      <div className="flex items-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Anexar arquivo"
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
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none text-[16px] leading-relaxed max-h-[120px] py-1"
          />
        </div>
        
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !hasContent}
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full"
          aria-label="Enviar mensagem"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
