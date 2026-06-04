"use client"

import { useEffect, useRef, useState, KeyboardEvent } from "react"
import { X, ImagePlus } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import type { UseMatchChatReturn, PollVote } from "@/hooks/useMatchChat"

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎯"]
const LONG_PRESS_MS = 450

interface MatchChatPanelProps {
  chat: UseMatchChatReturn
  playerAName: string
  playerBName: string
  myUserId: string
  isOpen: boolean
  onClose: () => void
}

export function MatchChatPanel({ chat, playerAName, playerBName, myUserId, isOpen, onClose }: MatchChatPanelProps) {
  const { messages, reactions, presenceUsers, myVote, sendMessage, sendImage, toggleReaction, castVote, markRead } = chat
  const [input, setInput] = useState("")
  const [sendingImage, setSendingImage] = useState(false)
  const [expandedImage, setExpandedImage] = useState<string | null>(null)
  const [pickerMsgId, setPickerMsgId] = useState<string | null>(null)
  const [pickerY, setPickerY] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isOpen) markRead()
  }, [isOpen, markRead])

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, isOpen])

  // Close picker when tapping outside
  useEffect(() => {
    if (!pickerMsgId) return
    function onPointerDown() { setPickerMsgId(null) }
    window.addEventListener("pointerdown", onPointerDown)
    return () => window.removeEventListener("pointerdown", onPointerDown)
  }, [pickerMsgId])

  function startLongPress(msgId: string, e: React.PointerEvent) {
    longPressTimer.current = setTimeout(() => {
      setPickerY(e.clientY)
      setPickerMsgId(msgId)
    }, LONG_PRESS_MS)
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

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

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    setSendingImage(true)
    try { await sendImage(file) } finally { setSendingImage(false) }
  }

  const votesA = presenceUsers.filter((u) => u.vote === "A").length
  const votesB = presenceUsers.filter((u) => u.vote === "B").length
  const totalVotes = votesA + votesB
  const pctA = totalVotes > 0 ? (votesA / totalVotes) * 100 : 50

  function handleVote(vote: PollVote) { castVote(myVote === vote ? null : vote) }

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex flex-col bg-card border-t border-border rounded-t-2xl shadow-2xl",
        "transition-transform duration-300 ease-in-out max-h-[70vh]",
        isOpen ? "translate-y-0" : "translate-y-full",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <span className="text-sm font-semibold">Match Chat</span>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Poll */}
      <div className="px-4 py-3 border-b border-border flex-shrink-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2.5">Who do you think will win?</p>
        <div className="flex gap-2 mb-2.5">
          {(["A", "B"] as const).map((side) => (
            <button
              key={side}
              onClick={() => handleVote(side)}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95",
                myVote === side ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {(side === "A" ? playerAName : playerBName).split(" ")[0]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-primary w-5 text-right">{votesA}</span>
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pctA}%` }} />
          </div>
          <span className="text-[10px] font-bold text-primary w-5">{votesB}</span>
        </div>
        {totalVotes > 0 && (
          <p className="text-[10px] text-muted-foreground text-center mt-1">{totalVotes} {totalVotes === 1 ? "vote" : "votes"}</p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 min-h-0">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">No messages yet. Say something!</p>
        )}
        {messages.map((msg) => {
          if (msg.isSystem) {
            return (
              <div key={msg.id} className="flex justify-center py-0.5">
                <span className="text-[11px] text-muted-foreground italic">· {msg.text} ·</span>
              </div>
            )
          }

          const msgReactions = reactions[msg.id] ?? {}
          const hasReactions = Object.keys(msgReactions).length > 0

          return (
            <div key={msg.id} className="flex flex-col gap-0.5 select-none">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] font-semibold text-primary">{msg.senderName}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              {/* Message bubble — long press to react */}
              <div
                className="self-start"
                onPointerDown={(e) => startLongPress(msg.id, e)}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onPointerCancel={cancelLongPress}
              >
                {msg.imageUrl ? (
                  <button onClick={() => setExpandedImage(msg.imageUrl!)} className="self-start">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={msg.imageUrl}
                      alt="shared image"
                      className="max-w-[200px] max-h-[200px] rounded-lg object-cover border border-border"
                    />
                  </button>
                ) : (
                  <p className="text-sm text-foreground leading-snug">{msg.text}</p>
                )}
              </div>

              {/* Reaction bubbles */}
              {hasReactions && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {Object.entries(msgReactions).map(([emoji, users]) => {
                    if (users.length === 0) return null
                    const iMine = users.includes(myUserId)
                    return (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(msg.id, emoji)}
                        className={cn(
                          "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-all active:scale-95",
                          iMine
                            ? "bg-primary/20 border-primary/40 text-primary"
                            : "bg-muted border-border text-muted-foreground hover:border-primary/30",
                        )}
                      >
                        <span>{emoji}</span>
                        <span className="font-semibold leading-none">{users.length}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 px-4 py-3 border-t border-border flex-shrink-0 pb-[max(12px,env(safe-area-inset-bottom))]">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={sendingImage}
          className="p-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 active:scale-95 transition-all flex-shrink-0"
        >
          <ImagePlus className="w-4 h-4" />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={sendingImage ? "Uploading…" : "Say something…"}
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

      {/* Emoji reaction picker — floats above the long-pressed message */}
      {pickerMsgId && (
        <div
          className="fixed z-50 flex items-center gap-1 px-3 py-2 rounded-2xl border border-border bg-card shadow-xl"
          style={{ left: "50%", transform: "translateX(-50%)", top: Math.max(pickerY - 60, 8) }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => { toggleReaction(pickerMsgId, emoji); setPickerMsgId(null) }}
              className="text-2xl leading-none p-1 rounded-xl hover:bg-muted active:scale-90 transition-all"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen image viewer */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setExpandedImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={expandedImage} alt="full size" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  )
}
