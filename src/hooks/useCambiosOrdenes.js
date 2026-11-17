import { useEffect } from 'react'
import { supabase } from '../supabaseClient.js'

// RNF-07: cualquier cambio en una orden refresca la vista en pocos segundos (Supabase Realtime).
// alCambiar debe ser una función estable (useCallback).
export function useCambiosOrdenes(alCambiar) {
  useEffect(() => {
    const nombre = `ordenes-${Math.random().toString(36).slice(2)}`
    const canal = supabase
      .channel(nombre)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_trabajo' }, () => alCambiar())
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [alCambiar])
}
