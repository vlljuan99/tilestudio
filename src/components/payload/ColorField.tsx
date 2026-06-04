'use client'

import { useField } from '@payloadcms/ui'
import { useEffect, useRef, useState } from 'react'
import { HexColorPicker } from 'react-colorful'

/**
 * Componente custom para campos de color en Payload.
 * Reemplaza el text input por:
 *   - Un cuadradito con el color actual (clickable, abre picker)
 *   - Un input hex editable
 *   - Un picker visual desplegable con paleta + sliders HSL
 *
 * Se conecta al campo del formulario via useField. El path se calcula a partir
 * de la prop `path` que Payload pasa al componente.
 */
type Props = {
  path?: string
  field?: { label?: string; admin?: { description?: string } }
}

export default function ColorField({ path: pathProp, field }: Props) {
  const path = pathProp || ''
  const { value, setValue } = useField<string>({ path })
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const current = (value || '#cccccc').toString()
  const validHex = /^#[0-9a-fA-F]{6}$/.test(current)
  const label = field?.label || friendlyLabel(path)

  // Cierra el popover al hacer click fuera
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="field-type" style={style.field}>
      <label className="field-label" style={style.label}>
        {label}
      </label>

      <div ref={wrapperRef} style={style.row}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={`Cambiar ${label}`}
          style={{
            ...style.swatch,
            background: validHex ? current : '#ffffff',
            borderColor: validHex ? 'var(--theme-elevation-200)' : 'var(--theme-error-500)',
          }}
        >
          {!validHex && <span style={{ color: 'var(--theme-error-500)', fontSize: 18 }}>?</span>}
        </button>

        <input
          type="text"
          value={current}
          onChange={(e) => {
            let v = e.target.value
            if (!v.startsWith('#')) v = '#' + v
            setValue(v.toLowerCase())
          }}
          placeholder="#000000"
          style={style.input}
          spellCheck={false}
        />

        {open && (
          <div style={style.popover}>
            <HexColorPicker
              color={validHex ? current : '#ffffff'}
              onChange={(c) => setValue(c)}
              style={{ width: 200, height: 200 }}
            />
            <div style={style.popoverPresets}>
              {PRESET_COLORS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setValue(p)}
                  aria-label={p}
                  style={{ ...style.presetSwatch, background: p }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {field?.admin?.description && (
        <p style={style.desc}>{field.admin.description}</p>
      )}
    </div>
  )
}

const PRESET_COLORS = [
  '#ffffff', '#f5f1ea', '#1f1b17', '#000000',
  '#7a4f23', '#b04621', '#8a6c30', '#5e564b',
  '#526cb5', '#2d4da7', '#43a047', '#1e88e5',
  '#fb8c00', '#8e24aa', '#c62828',
]

function friendlyLabel(path: string): string {
  const map: Record<string, string> = {
    colorPrimary: 'Color principal',
    colorAccent: 'Color de acento',
    colorBackground: 'Color de fondo',
    colorSurface: 'Color de superficie',
    colorText: 'Color de texto',
  }
  return map[path] || path
}

const style: Record<string, React.CSSProperties> = {
  field: { marginBottom: 16 },
  label: {
    display: 'block',
    fontSize: 13,
    marginBottom: 6,
    color: 'var(--theme-elevation-700)',
    fontWeight: 500,
  },
  row: { display: 'flex', gap: 8, alignItems: 'center', position: 'relative' },
  swatch: {
    width: 40,
    height: 40,
    border: '1px solid',
    borderRadius: 6,
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: 40,
    padding: '0 12px',
    border: '1px solid var(--theme-elevation-200)',
    borderRadius: 6,
    fontSize: 14,
    fontFamily: 'monospace',
    background: 'var(--theme-input-bg, #fff)',
    color: 'var(--theme-text)',
  },
  popover: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 8,
    background: 'var(--theme-elevation-0)',
    border: '1px solid var(--theme-elevation-200)',
    borderRadius: 8,
    padding: 12,
    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
    zIndex: 100,
  },
  popoverPresets: {
    marginTop: 10,
    display: 'grid',
    gridTemplateColumns: 'repeat(8, 1fr)',
    gap: 4,
  },
  presetSwatch: {
    aspectRatio: '1',
    border: '1px solid var(--theme-elevation-150)',
    borderRadius: 4,
    cursor: 'pointer',
    padding: 0,
  },
  desc: { fontSize: 12, color: 'var(--theme-elevation-500)', margin: '4px 0 0 0' },
}
