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

// 2× the CSS pixel size for retina displays
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
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const px = sizePixels[size]

  // Show fallback until image is confirmed loaded, or if there's no URL / load error
  const showFallback = !avatarUrl || imgError || !imgLoaded

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {avatarUrl && !imgError && (
        <Image
          src={avatarUrl}
          alt={name}
          width={px}
          height={px}
          // Keep in DOM so the browser fetches it, but hide until loaded to prevent
          // AvatarFallback overlap (Radix's fallback only auto-hides for its own AvatarImage)
          className={cn("aspect-square h-full w-full object-cover", !imgLoaded && "hidden")}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
        />
      )}
      {showFallback && (
        <AvatarFallback className="bg-primary/20 text-primary font-semibold">
          {getInitials(name)}
        </AvatarFallback>
      )}
    </Avatar>
  )
}
