import { createClient } from "@supabase/supabase-js"

// Browser client — used for Realtime subscriptions only
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
