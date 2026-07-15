'use client'

/**
 * Acceso a la zona de ventas con las mismas cuentas de usuario de siempre,
 * pero sin pasar por la pantalla de Payload: los comerciales entran y salen
 * sin ver nunca el admin técnico.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = { siteName: string; logoUrl: string | null }

export function VentasLogin({ siteName, logoUrl }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        throw new Error('Email o contraseña incorrectos.')
      }
      router.push('/ventas')
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="text-center mb-6">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={siteName} className="h-12 mx-auto object-contain" />
          ) : (
            <p className="text-2xl font-serif">{siteName}</p>
          )}
          <p className="text-sm text-muted-foreground mt-2">Zona de ventas</p>
        </div>

        <label className="block text-sm">
          <span className="block text-xs text-muted-foreground mb-1">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 rounded-md border border-border bg-background px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="block text-xs text-muted-foreground mb-1">Contraseña</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 rounded-md border border-border bg-background px-3"
          />
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full h-11 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50"
        >
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
