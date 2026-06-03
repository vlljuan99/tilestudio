'use client'

import { useEffect, useState } from 'react'
import { MessageCircle, Mail, Phone, X, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { buildWhatsAppLink } from '@/lib/utils'

type Settings = {
  siteName?: string | null
  whatsappNumber?: string | null
  phone?: string | null
  email?: string | null
} | null

type Props = {
  open: boolean
  onClose: () => void
  sessionToken: string
  generationId: number | string
  tileId?: number | string
  tileName?: string | null
  tileSku?: string | null
  settings: Settings
  shareUrl: string
  surfaceLabel: string
}

type Channel = 'whatsapp' | 'email' | 'phone'

export function LeadModal({
  open,
  onClose,
  sessionToken,
  generationId,
  tileId,
  tileName,
  tileSku,
  settings,
  shareUrl,
  surfaceLabel,
}: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [sqm, setSqm] = useState('')
  const [dontKnow, setDontKnow] = useState(false)
  const [comment, setComment] = useState('')
  const [channel, setChannel] = useState<Channel>('whatsapp')
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function submit() {
    setError(null)
    if (!consent) {
      setError('Debes aceptar la política de privacidad.')
      return
    }
    if (channel === 'whatsapp' && !phone) {
      setError('Necesitamos tu teléfono para responderte por WhatsApp.')
      return
    }
    if (channel === 'email' && !email) {
      setError('Necesitamos tu email para responderte.')
      return
    }
    if (channel === 'phone' && !phone) {
      setError('Necesitamos tu teléfono para llamarte.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name || undefined,
          phone: phone || undefined,
          email: email || undefined,
          sqMeters: sqm ? Number(sqm) : undefined,
          dontKnowSqm: dontKnow,
          comment: comment || undefined,
          preferredChannel: channel,
          source: 'simulator',
          tileId,
          sessionToken,
          generationId,
          shareUrl,
          consent: true,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'No se pudo enviar el mensaje.')
      }

      if (channel === 'whatsapp') {
        const wa = buildWhatsAppLink({
          number: settings?.whatsappNumber,
          message: `Hola, soy ${name || 'un cliente del simulador'}.
Me interesa el azulejo "${tileName}"${tileSku ? ` (ref. ${tileSku})` : ''}.
Superficie: ${surfaceLabel}.
Aquí mi simulación: ${shareUrl}
${sqm ? `Metros aprox: ${sqm} m².` : dontKnow ? 'No sé los metros aún.' : ''}
${comment ? `Comentario: ${comment}` : ''}`,
        })
        if (wa) window.location.href = wa
        else onClose()
      } else if (channel === 'email') {
        const target = settings?.email
        if (target) {
          const subject = encodeURIComponent(`Interés en ${tileName || 'un azulejo'}`)
          const body = encodeURIComponent(
            `Soy ${name || '(sin nombre)'}.\nAzulejo: ${tileName}\nSimulación: ${shareUrl}\n${comment}`,
          )
          window.location.href = `mailto:${target}?subject=${subject}&body=${body}`
        } else onClose()
      } else {
        if (settings?.phone) window.location.href = `tel:${settings.phone}`
        else onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-0 md:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-background w-full md:max-w-md md:rounded-lg rounded-t-2xl max-h-[90vh] overflow-y-auto"
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-medium">Contactar</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
                { key: 'email', label: 'Email', icon: Mail },
                { key: 'phone', label: 'Llamada', icon: Phone },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setChannel(key)}
                className={`border rounded-md p-3 text-sm flex flex-col items-center gap-1 ${
                  channel === key ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </div>

          <Field label="Nombre">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              placeholder="Cómo te llamas (opcional)"
            />
          </Field>

          <Field label="Teléfono">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputCls}
              placeholder="6XX XXX XXX"
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="tucorreo@dominio.com (opcional)"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3 items-end">
            <Field label="Metros aprox.">
              <input
                type="number"
                value={sqm}
                onChange={(e) => {
                  setSqm(e.target.value)
                  if (e.target.value) setDontKnow(false)
                }}
                disabled={dontKnow}
                className={inputCls}
                placeholder="ej. 18"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm pb-2">
              <input
                type="checkbox"
                checked={dontKnow}
                onChange={(e) => {
                  setDontKnow(e.target.checked)
                  if (e.target.checked) setSqm('')
                }}
              />
              No lo sé
            </label>
          </div>

          <Field label="Comentario">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className={`${inputCls} min-h-20 py-2`}
              placeholder="¿Algo que quieras añadir? (opcional)"
            />
          </Field>

          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Acepto que {settings?.siteName || 'Tilestudio'} contacte conmigo y trate mis datos
              para responder a esta consulta. Más información en la política de privacidad.
            </span>
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <footer className="border-t border-border px-5 py-4 flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting} className="flex-1">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar'}
          </Button>
        </footer>
      </div>
    </div>
  )
}

const inputCls =
  'w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block mb-1 text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
