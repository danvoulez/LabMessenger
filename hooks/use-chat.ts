'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { chatProvider } from '@/lib/chat'
import type { Message, ConnectionStatus } from '@/lib/chat'

interface UseChatOptions {
  roomId: string
  userId: string
  username: string
}

export function useChat({ roomId, userId, username }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([])
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialLoadDone = useRef(false)

  // Load initial messages and subscribe
  useEffect(() => {
    if (!roomId) return

    setIsLoading(true)
    setError(null)
    initialLoadDone.current = false

    // Load existing messages
    chatProvider.getMessages(roomId)
      .then((existingMessages) => {
        setMessages(existingMessages)
        initialLoadDone.current = true
        setIsLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setIsLoading(false)
      })

    // Subscribe to new messages
    const unsubscribeMessages = chatProvider.subscribe(roomId, (newMessage) => {
      // Only add if initial load is done (to avoid duplicates)
      if (initialLoadDone.current) {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(m => m.id === newMessage.id)) {
            return prev
          }
          return [...prev, newMessage]
        })
      }
    })

    // Subscribe to connection status
    const unsubscribeStatus = chatProvider.onConnectionChange(setStatus)

    return () => {
      unsubscribeMessages()
      unsubscribeStatus()
    }
  }, [roomId])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return

    try {
      const message = await chatProvider.sendMessage({
        content: content.trim(),
        userId,
        username,
        roomId,
      })

      // Add to local state immediately for optimistic update
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) {
          return prev
        }
        return [...prev, message]
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
      throw err
    }
  }, [roomId, userId, username])

  return {
    messages,
    sendMessage,
    status,
    isLoading,
    error,
  }
}
