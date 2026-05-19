"use client"

import { getCheckoutSuggestion } from "@/lib/algorithms/checkout-suggestions"

export function useCheckoutSuggestion(remainder: number): string[] | null {
  if (remainder < 2 || remainder > 170) return null
  return getCheckoutSuggestion(remainder) ?? null
}
