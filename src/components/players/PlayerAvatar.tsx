"use client"

import { useState } from "react"
import Image from "next/image"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils/cn"

interface PlayerAvatarProps {
  name: string
  avatarUrl?: string | null
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizeClasses = {
  sm: "w-7 h-7 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-20 h-20 text-2xl",
}

// 2× the CSS pixel size for retina displays — passed to Next.js Image sizes hint
const sizePixels = {
  sm: 56,
  md: 72,
  lg: 96,
  xl: 160,
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function PlayerAvatar({ name, avatarUrl, size = "md", className }: PlayerAvatarProps) {
  const [imgError, setImgError] = useState(false)
  const px = sizePixels[size]

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {/* Fallback sits in normal flow; the Image is position:absolute (fill) so it
          naturally covers the fallback once pixels arrive, with no display:none trick
          that would block Next.js lazy loading from ever firing onLoad. */}
      <AvatarFallback className="bg-primary/20 text-primary font-semibold">
        {getInitials(name)}
      </AvatarFallback>
      {avatarUrl && !imgError && (
        <Image
          src={avatarUrl}
          alt={name}
          fill
          loading="eager"
          sizes={`${px}px`}
          className="object-cover"
          onError={() => setImgError(true)}
        />
      )}
    </Avatar>
  )
}
