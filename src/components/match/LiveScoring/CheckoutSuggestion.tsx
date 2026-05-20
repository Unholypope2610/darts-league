"use client"

import { getCheckoutSuggestionText } from "@/lib/algorithms/checkout-suggestions"
import { cn } from "@/lib/utils/cn"

interface CheckoutSuggestionProps {
  remainder: number
  className?: string
}

export function CheckoutSuggestion({ remainder, className }: CheckoutSuggestionProps) {
  if (remainder > 170 || remainder < 2) return null

  const suggestion = getCheckoutSuggestionText(remainder)
  if (!suggestion) return null

  return (
    <div className={cn("flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30", className)}>
      <span className="text-[9px] font-semibold text-emerald-400 uppercase tracking-widest">Checkout</span>
      <span className="text-xs font-bold text-emerald-300 font-score whitespace-nowrap">{suggestion}</span>
    </div>
  )
}
