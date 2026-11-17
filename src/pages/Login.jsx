import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { configurado } from '../supabaseClient.js'

export default function Login() {
  const { session, perfil, aviso, iniciarSesion } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (session && perfil) return <Navigate to="/" replace />

  if (!configurado) {
    return (
      <div className="login">
        <div className="tarjeta">
          <h1>Falta configurar .env</h1>
          <p>Copia .env.example como .env, completa la URL y la clave pública de Supabase y reinicia con npm run dev.</p>
        </div>
      </div>
    )
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Ingresa tu correo y tu contraseña.')
      return
    }
    setEnviando(true)
    setError(await iniciarSesion(email.trim(), password))
    setEnviando(false)
  }

  return (
    <div className="login">
      <form className="tarjeta" onSubmit={enviar} noValidate>
        <h1>Taller Los Pistoneros</h1>
        <p className="sub">Ingresa con tu cuenta del taller</p>

        <label htmlFor="email">Correo</label>
        <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />

        <label htmlFor="password">Contraseña</label>
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <button className="btn btn-primario" type="submit" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>

        {(error || aviso) && <p className="error" role="alert">{error || aviso}</p>}
        <p className="nota">¿No tienes cuenta? Pídesela al dueño del taller.</p>
      </form>
    </div>
  )
}
