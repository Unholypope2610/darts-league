import { cn } from "@/lib/utils/cn"

interface StatBadgeProps {
  label: string
  value: string | number
  className?: string
}

export function StatBadge({ label, value, className }: StatBadgeProps) {
  return (
    <div className={cn("flex flex-col items-center px-4 py-2 rounded-xl bg-muted/50 border border-border", className)}>
      <span className="font-score text-xl font-bold">{value}</span>
      <span className="text-xs text-muted-foreground mt-0.5">{label}</span>
    </div>
  )
}
