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
    <div className={cn("flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30", className)}>
      <span className="text-xs font-medium text-emerald-400 uppercase tracking-wide">Checkout</span>
      <span className="text-sm font-bold text-emerald-300 font-score">{suggestion}</span>
    </div>
  )
}
