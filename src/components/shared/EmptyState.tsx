import { cn } from "@/lib/utils/cn"

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      {icon && <div className="text-muted-foreground/50 mb-4">{icon}</div>}
      <h3 className="font-semibold text-lg mb-1">{title}</h3>
      {description && <p className="text-muted-foreground text-sm max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  )
}
