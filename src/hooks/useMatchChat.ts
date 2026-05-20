"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { getSupabase } from "@/lib/supabase"

export type PollVote = "A" | "B" | null

export interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  text: string
  timestamp: number
}

export interface PresenceUser {
  userId: string
  name: string
  vote: PollVote
}

export interface UseMatchChatReturn {
  messages: ChatMessage[]
  presenceUsers: PresenceUser[]
  myVote: PollVote
  sendMessage: (text: string) => void
  castVote: (vote: PollVote) => void
  unreadCount: number
  markRead: () => void
}

interface UseMatchChatOptions {
  matchId: string
  userId: string
  userName: string
  isOpen: boolean
}

export function useMatchChat({ matchId, userId, userName, isOpen }: UseMatchChatOptions): UseMatchChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([])
  const [myVote, setMyVote] = useState<PollVote>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>["channel"]> | null>(null)
  const isOpenRef = useRef(isOpen)
  const userNameRef = useRef(userName)

  // Keep refs in sync without resubscribing
  useEffect(() => { isOpenRef.current = isOpen }, [isOpen])
  useEffect(() => { userNameRef.current = userName }, [userName])

  useEffect(() => {
    if (!matchId || !userId) return

    const supabase = getSupabase()
    const channel = supabase.channel(`chat:${matchId}`)
    channelRef.current = channel

    channel.on("broadcast", { event: "MESSAGE" }, ({ payload }) => {
      setMessages((prev) => [...prev, payload as ChatMessage])
      if (!isOpenRef.current) setUnreadCount((c) => c + 1)
    })

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresenceUser>()
      const users = Object.values(state).flat()
      setPresenceUsers(users)
    })

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ userId, name: userNameRef.current, vote: null } as PresenceUser)
      }
    })

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [matchId, userId])

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      senderId: userId,
      senderName: userNameRef.current,
      text: trimmed,
      timestamp: Date.now(),
    }
    // Optimistic push — Supabase Broadcast does not echo to sender
    setMessages((prev) => [...prev, msg])
    channelRef.current?.send({ type: "broadcast", event: "MESSAGE", payload: msg })
  }, [userId])

  const castVote = useCallback(async (vote: PollVote) => {
    setMyVote(vote)
    await channelRef.current?.track({ userId, name: userNameRef.current, vote } as PresenceUser)
  }, [userId])

  const markRead = useCallback(() => {
    setUnreadCount(0)
  }, [])

  return { messages, presenceUsers, myVote, sendMessage, castVote, unreadCount, markRead }
}
