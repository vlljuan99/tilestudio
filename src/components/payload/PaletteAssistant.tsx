'use client'

import { useField } from '@payloadcms/ui'
import { useState } from 'react'

export default function PaletteAssistant() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [preview, setPreview] = useState<{
    primary: string
    accent: string
    background: string
    surface: string
    text: string
    all: { hex: string }[]
  } | null>(null)

  // useField nos da setValue por campo, que marca el form como dirty
  // y permite que el botón "Guardar" persista los cambios.
  const logo = useField<any>({ path: 'logo' })
  const primary = useField<string>({ path: 'colorPrimary' })
  const accent = useField<string>({ path: 'colorAccent' })
  const background = useField<string>({ path: 'colorBackground' })
  const surface = useField<string>({ path: 'colorSurface' })
  const text = useField<string>({ path: 'colorText' })

  async function suggest() {
    setBusy(true)
    setMsg(null)
    setPreview(null)
    try {
      const logoValue = logo.value
      if (!logoValue) {
        setMsg('Sube un logo en la pestaña "Marca" primero. Sin logo no podemos sugerir colores.')
        return
      }
      const mediaId = typeof logoValue === 'object' ? (logoValue as any).id : logoValue
      const res = await fetch(`/api/admin/extract-palette?mediaId=${mediaId}`, {
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg(data?.error || 'No se pudo analizar el logo.')
        return
      }
      setPreview(data.palette)
      setMsg('Hemos sacado estos colores de tu logo. Pulsa "Aplicar" para usarlos.')
    } catch (err) {
      setMsg((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function apply() {
    if (!preview) return
    primary.setValue(preview.primary)
    accent.setValue(preview.accent)
    background.setValue(preview.background)
    surface.setValue(preview.surface)
    text.setValue(preview.text)
    setMsg('✓ Colores aplicados. Pulsa "Guardar" arriba para verlos en la web.')
  }

  return (
    <div style={style.box}>
      <div style={style.head}>
        <p style={style.title}>Sugerencia de colores desde tu logo</p>
        <button
          type="button"
          onClick={suggest}
          disabled={busy}
          style={{ ...style.btn, ...style.btnPrimary }}
        >
          {busy ? 'Analizando…' : 'Sugerir paleta desde el logo'}
        </button>
      </div>

      <p style={style.desc}>
        Subimos tu logo a la pestaña "Marca" y el sistema saca los colores principales para
        proponer una paleta. Después puedes ajustarlos a mano si quieres.
      </p>

      {msg && <p style={style.msg}>{msg}</p>}

      {preview && (
        <>
          <p style={style.subtitle}>Paleta sugerida</p>
          <div style={style.swatchRow}>
            {(
              [
                ['Principal', preview.primary],
                ['Acento', preview.accent],
                ['Fondo', preview.background],
                ['Superficie', preview.surface],
                ['Texto', preview.text],
              ] as const
            ).map(([label, hex]) => (
              <div key={label} style={style.swatch}>
                <div style={{ ...style.swatchColor, background: hex }} />
                <p style={style.swatchLabel}>{label}</p>
                <p style={style.swatchHex}>{hex}</p>
              </div>
            ))}
          </div>

          {preview.all?.length > 0 && (
            <>
              <p style={style.subtitle}>Otros colores encontrados</p>
              <div style={style.swatchRow}>
                {preview.all.map((c, i) => (
                  <div key={i} style={style.miniSwatch}>
                    <div style={{ ...style.miniSwatchColor, background: c.hex }} />
                    <p style={style.miniSwatchHex}>{c.hex}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          <button
            type="button"
            onClick={apply}
            style={{ ...style.btn, ...style.btnPrimary, marginTop: 16 }}
          >
            Aplicar esta paleta a los campos
          </button>
        </>
      )}
    </div>
  )
}

const style: Record<string, React.CSSProperties> = {
  box: {
    border: '1px solid var(--theme-elevation-150)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    background: 'var(--theme-elevation-50)',
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  title: { margin: 0, fontWeight: 600, fontSize: 14 },
  desc: { margin: '8px 0 0 0', fontSize: 13, color: 'var(--theme-elevation-500)' },
  subtitle: {
    margin: '16px 0 8px 0',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 600,
    color: 'var(--theme-elevation-700)',
  },
  msg: {
    margin: '12px 0 0 0',
    fontSize: 13,
    padding: '8px 12px',
    background: 'var(--theme-elevation-100)',
    borderRadius: 4,
  },
  swatchRow: { display: 'flex', flexWrap: 'wrap', gap: 12 },
  swatch: {
    flex: '1 1 100px',
    minWidth: 100,
    maxWidth: 140,
    border: '1px solid var(--theme-elevation-150)',
    borderRadius: 6,
    overflow: 'hidden',
    background: 'var(--theme-elevation-0)',
  },
  swatchColor: { height: 70 },
  swatchLabel: { margin: 0, padding: '6px 8px 0 8px', fontSize: 11, fontWeight: 600 },
  swatchHex: {
    margin: 0,
    padding: '0 8px 6px 8px',
    fontSize: 11,
    fontFamily: 'monospace',
    color: 'var(--theme-elevation-500)',
  },
  miniSwatch: { width: 56 },
  miniSwatchColor: { height: 40, borderRadius: 4, border: '1px solid var(--theme-elevation-150)' },
  miniSwatchHex: {
    margin: '2px 0 0 0',
    fontSize: 10,
    fontFamily: 'monospace',
    textAlign: 'center',
    color: 'var(--theme-elevation-500)',
  },
  btn: {
    padding: '8px 16px',
    borderRadius: 4,
    border: 'none',
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: 500,
  },
  btnPrimary: { background: 'var(--theme-success-500)', color: 'white' },
}
