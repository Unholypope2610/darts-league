"use client"

import { useEffect, useRef, useState, KeyboardEvent } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import type { UseMatchChatReturn, PollVote } from "@/hooks/useMatchChat"

interface MatchChatPanelProps {
  chat: UseMatchChatReturn
  playerAName: string
  playerBName: string
  isOpen: boolean
  onClose: () => void
}

export function MatchChatPanel({ chat, playerAName, playerBName, isOpen, onClose }: MatchChatPanelProps) {
  const { messages, presenceUsers, myVote, sendMessage, castVote, markRead } = chat
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  // Mark messages read when panel opens
  useEffect(() => {
    if (isOpen) markRead()
  }, [isOpen, markRead])

  // Auto-scroll to latest message
  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages.length, isOpen])

  function handleSend() {
    if (!input.trim()) return
    sendMessage(input)
    setInput("")
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Poll tallying
  const votesA = presenceUsers.filter((u) => u.vote === "A").length
  const votesB = presenceUsers.filter((u) => u.vote === "B").length
  const totalVotes = votesA + votesB
  const pctA = totalVotes > 0 ? (votesA / totalVotes) * 100 : 50

  function handleVote(vote: PollVote) {
    castVote(myVote === vote ? null : vote)
  }

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex flex-col bg-card border-t border-border rounded-t-2xl shadow-2xl",
        "transition-transform duration-300 ease-in-out",
        "max-h-[70vh]",
        isOpen ? "translate-y-0" : "translate-y-full",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <span className="text-sm font-semibold">Match Chat</span>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Poll */}
      <div className="px-4 py-3 border-b border-border flex-shrink-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2.5">
          Who do you think will win?
        </p>
        <div className="flex gap-2 mb-2.5">
          <button
            onClick={() => handleVote("A")}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95",
              myVote === "A"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {playerAName.split(" ")[0]}
          </button>
          <button
            onClick={() => handleVote("B")}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95",
              myVote === "B"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {playerBName.split(" ")[0]}
          </button>
        </div>
        {/* Vote bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-primary w-5 text-right">{votesA}</span>
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${pctA}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-primary w-5">{votesB}</span>
        </div>
        {totalVotes > 0 && (
          <p className="text-[10px] text-muted-foreground text-center mt-1">
            {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
          </p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 min-h-0">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            No messages yet. Say something!
          </p>
        )}
        {messages.map((msg) =>
          msg.isSystem ? (
            <div key={msg.id} className="flex justify-center py-0.5">
              <span className="text-[11px] text-muted-foreground italic">· {msg.text} ·</span>
            </div>
          ) : (
            <div key={msg.id} className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] font-semibold text-primary">{msg.senderName}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-sm text-foreground leading-snug">{msg.text}</p>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 px-4 py-3 border-t border-border flex-shrink-0 pb-[max(12px,env(safe-area-inset-bottom))]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Say something…"
          maxLength={200}
          className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 active:scale-95 transition-all"
        >
          Send
        </button>
      </div>
    </div>
  )
}
