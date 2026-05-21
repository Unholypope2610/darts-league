"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Camera, Loader2 } from "lucide-react"
import { PlayerAvatar } from "./PlayerAvatar"

interface AvatarUploadProps {
  playerId: string
  name: string
  currentUrl?: string | null
  onUploadComplete: (url: string) => void
}

export function AvatarUpload({ playerId, name, currentUrl, onUploadComplete }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File) {
    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch(`/api/players/${playerId}/avatar`, { method: "POST", body: formData })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Upload failed")
        return
      }
      setPreviewUrl(json.avatarUrl)
      onUploadComplete(json.avatarUrl)
    } catch {
      toast.error("Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative group focus:outline-none"
        aria-label="Upload avatar"
      >
        <PlayerAvatar name={name} avatarUrl={previewUrl ?? currentUrl} size="xl" />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading
            ? <Loader2 className="w-6 h-6 text-white animate-spin" />
            : <Camera className="w-6 h-6 text-white" />
          }
        </span>
      </button>
      <p className="text-xs text-muted-foreground">Tap to change photo</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ""
        }}
      />
    </div>
  )
}
