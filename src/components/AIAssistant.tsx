'use client'
import { useState, useRef, useEffect } from 'react'
import { AIMessage } from '@/types'

interface Props {
  messages: AIMessage[]
  isLoading: boolean
  statusText: string
  onSend: (msg: string) => void
  onClear: () => void
  isOpen: boolean
  onToggle: () => void
  onOpenMemory: () => void
}

const SUGGESTIONS = [
  'Why are players dying in the selected area?',
  'What is the kill density of this region?',
  'Compare activity in the north vs south of the map',
  'Show me where the storm is killing most players',
]

export default function AIAssistant({
  messages, isLoading, statusText, onSend, onClear, isOpen, onToggle, onOpenMemory,
}: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, statusText])

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <div className={`border-t border-gray-700 bg-gray-900 transition-all duration-300 ${isOpen ? 'h-80' : 'h-10'}`}>
      {/* Header bar */}
      <button
        onClick={onToggle}
        className="w-full h-10 px-4 flex items-center justify-between text-xs text-gray-300 hover:text-white transition-colors"
      >
        <span className="flex items-center gap-2 font-medium">
          <span className="text-blue-400">⚡</span> AI Assistant
          {messages.length > 0 && (
            <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded-full text-xs">
              {messages.filter(m => m.role === 'assistant').length}
            </span>
          )}
          {isLoading && statusText && (
            <span className="text-blue-400 animate-pulse text-[11px]">{statusText}</span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onOpenMemory() }}
            onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), onOpenMemory())}
            className="text-[11px] text-gray-600 hover:text-purple-400 transition-colors px-2 py-0.5 rounded hover:bg-gray-800"
          >
            Memory
          </span>
          <span className="text-gray-600">{isOpen ? '▼' : '▲'}</span>
        </span>
      </button>

      {isOpen && (
        <div className="flex flex-col h-[calc(100%-2.5rem)]">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
            {messages.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Ask me anything about the selected matches or region.</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => onSend(s)}
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded-full transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] text-xs px-3 py-2 rounded-lg leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-200'
                  }`}>
                    {msg.content || (isLoading && i === messages.length - 1 ? (
                      <span className="text-gray-500 animate-pulse">{statusText || 'Working...'}</span>
                    ) : null)}
                    {!msg.content && isLoading && i === messages.length - 1 && (
                      <span className="text-gray-500 animate-pulse">{statusText || 'Working...'}</span>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 pb-3 flex gap-2">
            {messages.length > 0 && (
              <button onClick={onClear} className="text-xs text-gray-600 hover:text-gray-400 shrink-0">Clear</button>
            )}
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask about selected matches or region..."
              className="flex-1 bg-gray-800 text-white text-xs px-3 py-2 rounded border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-600"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs px-3 py-2 rounded transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
