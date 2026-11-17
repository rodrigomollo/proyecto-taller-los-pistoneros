import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient.js'

const AuthContext = createContext(null)

// RNF-05: la sesión se cierra tras 30 minutos de inactividad.
const INACTIVIDAD_MS = 30 * 60 * 1000

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [aviso, setAviso] = useState('')
  const temporizador = useRef(null)

  const cerrarSesion = useCallback(async (mensaje = '') => {
    await supabase.auth.signOut()
    setPerfil(null)
    setAviso(mensaje)
  }, [])

  const cargarPerfil = useCallback(
    async (userId) => {
      const { data, error } = await supabase
        .from('perfiles')
        .select('id, nombre, rol, activo')
        .eq('id', userId)
        .single()
      if (error || !data || !data.activo) {
        await cerrarSesion('Tu cuenta no está disponible. Consulta con el dueño del taller.')
        return
      }
      setPerfil(data)
    },
    [cerrarSesion]
  )

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session)
        if (data.session) return cargarPerfil(data.session.user.id)
      })
      .finally(() => setCargando(false))

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, nueva) => {
      setSession(nueva)
      if (!nueva) setPerfil(null)
      // Se difiere para no llamar a Supabase dentro del propio callback.
      else setTimeout(() => cargarPerfil(nueva.user.id), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [cargarPerfil])

  // Cierre automático por inactividad.
  useEffect(() => {
    if (!session) return undefined
    const reiniciar = () => {
      clearTimeout(temporizador.current)
      temporizador.current = setTimeout(
        () => cerrarSesion('Tu sesión se cerró por inactividad.'),
        INACTIVIDAD_MS
      )
    }
    const eventos = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll']
    eventos.forEach((e) => window.addEventListener(e, reiniciar))
    reiniciar()
    return () => {
      clearTimeout(temporizador.current)
      eventos.forEach((e) => window.removeEventListener(e, reiniciar))
    }
  }, [session, cerrarSesion])

  const iniciarSesion = async (email, password) => {
    setAviso('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    // Mensaje genérico: no revela si el correo existe.
    return error ? 'Correo o contraseña incorrectos.' : ''
  }

  const valor = { session, perfil, rol: perfil?.rol ?? null, cargando, aviso, iniciarSesion, cerrarSesion }
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
