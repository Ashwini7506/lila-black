'use client'
import { useState, useCallback, useRef } from 'react'
import { AIMessage, Region, MapId } from '@/types'

export function useAIChat(
  matchIds: string[],
  mapId: MapId | null,
  selectedRegion: Region | null,
  designerId: string | null
) {
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [statusText, setStatusText] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const historyRef = useRef<any[]>([])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return
    setMessages(prev => [...prev, { role: 'user', content }])
    setIsLoading(true)
    setStatusText('Thinking...')

    // Placeholder assistant message — filled in token by token
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          matchIds,
          mapId,
          selectedRegion,
          designerId,
          history: historyRef.current,
        }),
      })

      if (!res.ok || !res.body) throw new Error('Failed to connect')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'status') {
              setStatusText(event.text)
            } else if (event.type === 'token') {
              setMessages(prev => {
                const copy = [...prev]
                const last = copy[copy.length - 1]
                if (last?.role === 'assistant') {
                  copy[copy.length - 1] = { ...last, content: last.content + event.content }
                }
                return copy
              })
            } else if (event.type === 'done') {
              historyRef.current = event.history ?? []
              setStatusText('')
            } else if (event.type === 'error') {
              setMessages(prev => {
                const copy = [...prev]
                const last = copy[copy.length - 1]
                if (last?.role === 'assistant') {
                  copy[copy.length - 1] = { ...last, content: 'Something went wrong. Please try again.' }
                }
                return copy
              })
              setStatusText('')
            }
          } catch { /* ignore malformed JSON */ }
        }
      }
    } catch {
      setMessages(prev => {
        const copy = [...prev]
        const last = copy[copy.length - 1]
        if (last?.role === 'assistant') {
          copy[copy.length - 1] = { ...last, content: 'Something went wrong. Please try again.' }
        }
        return copy
      })
      setStatusText('')
    } finally {
      setIsLoading(false)
      setStatusText('')
    }
  }, [matchIds, mapId, selectedRegion, designerId])

  return {
    messages,
    isLoading,
    statusText,
    sendMessage,
    clearMessages: () => {
      setMessages([])
      historyRef.current = []
    },
  }
}
