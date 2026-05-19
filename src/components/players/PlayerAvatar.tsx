import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function PlayerAvatar({ name, avatarUrl, size = "md", className }: PlayerAvatarProps) {
  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
      <AvatarFallback className="bg-primary/20 text-primary font-semibold">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
