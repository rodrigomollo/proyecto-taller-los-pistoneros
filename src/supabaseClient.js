import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configurado = Boolean(url && anonKey)

// Solo se usa la clave publicable. Los permisos reales los aplica RLS en la base de datos.
export const supabase = createClient(url || 'http://localhost', anonKey || 'sin-configurar')
