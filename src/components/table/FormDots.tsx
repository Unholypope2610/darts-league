import { cn } from "@/lib/utils/cn"
import type { FormResult } from "@/types/table"

interface FormDotsProps {
  form: FormResult[]
}

const dotColor: Record<FormResult, string> = {
  W: "bg-emerald-500",
  D: "bg-amber-500",
  L: "bg-red-500",
}

const dotLabel: Record<FormResult, string> = {
  W: "Win",
  D: "Draw",
  L: "Loss",
}

export function FormDots({ form }: FormDotsProps) {
  return (
    <div className="flex items-center gap-1" aria-label="Recent form">
      {form.slice(-5).map((result, i) => (
        <div
          key={i}
          className={cn("w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold", dotColor[result])}
          title={dotLabel[result]}
          aria-label={dotLabel[result]}
        >
          {result}
        </div>
      ))}
    </div>
  )
}
