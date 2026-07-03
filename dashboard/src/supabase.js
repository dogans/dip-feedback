import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Env verilmişse Supabase modu; yoksa null → dashboard eski (yerel) API'ye düşer.
export const supabase = url && key ? createClient(url, key) : null
