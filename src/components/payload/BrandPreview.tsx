'use client'

import { useField } from '@payloadcms/ui'
import { useEffect } from 'react'

const RADIUS_VALUES: Record<string, string> = {
  none: '0px',
  medium: '8px',
  large: '16px',
  pill: '999px',
}

export default function BrandPreview() {
  const fields = {
    primary: (useField<string>({ path: 'colorPrimary' }).value as string) || '#7a4f23',
    accent: (useField<string>({ path: 'colorAccent' }).value as string) || '#b04621',
    background: (useField<string>({ path: 'colorBackground' }).value as string) || '#f5f1ea',
    surface: (useField<string>({ path: 'colorSurface' }).value as string) || '#ede8db',
    text: (useField<string>({ path: 'colorText' }).value as string) || '#1f1b17',
    serif: (useField<string>({ path: 'fontSerif' }).value as string) || 'Fraunces',
    sans: (useField<string>({ path: 'fontSans' }).value as string) || 'Inter',
    radius: (useField<string>({ path: 'cornerRadius' }).value as string) || 'medium',
  }

  // Cargamos las fuentes de Google bajo demanda para que se vean en el preview
  useEffect(() => {
    const families = [fields.serif, fields.sans]
      .map((f: string) => f.replace(/ /g, '+'))
      .map((f: string) => `family=${f}:wght@400;500;600;700`)
      .join('&')
    const href = `https://fonts.googleapis.com/css2?${families}&display=swap`
    const id = 'brand-preview-fonts'
    let link = document.getElementById(id) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    link.href = href
  }, [fields.serif, fields.sans])

  const radius = RADIUS_VALUES[fields.radius] || RADIUS_VALUES.medium

  return (
    <div style={style.wrapper}>
      <p style={style.label}>Vista previa de cómo se verá tu web</p>
      <div
        style={{
          ...style.preview,
          background: fields.background,
          color: fields.text,
          fontFamily: `'${fields.sans}', system-ui, sans-serif`,
        }}
      >
        {/* Mini header */}
        <div style={style.previewHeader}>
          <span style={{ fontFamily: `'${fields.serif}', serif`, fontWeight: 600, fontSize: 18 }}>
            Tilestudio
          </span>
          <nav style={style.previewNav}>
            <span>Catálogo</span>
            <span>Ambientes</span>
            <span style={{ color: fields.primary, fontWeight: 600 }}>Simulador IA</span>
          </nav>
          <button
            style={{
              background: fields.primary,
              color: '#fff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: radius,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'default',
            }}
          >
            Probar con IA
          </button>
        </div>

        {/* Hero */}
        <div style={style.previewBody}>
          <div>
            <span
              style={{
                display: 'inline-block',
                background: `${fields.accent}22`,
                color: fields.accent,
                padding: '4px 10px',
                borderRadius: radius,
                fontSize: 11,
                fontWeight: 500,
                marginBottom: 12,
              }}
            >
              ✨ Simulación con IA
            </span>
            <h1
              style={{
                fontFamily: `'${fields.serif}', serif`,
                fontSize: 28,
                lineHeight: 1.1,
                margin: 0,
                fontWeight: 500,
              }}
            >
              Visualiza azulejos en tu propia foto
            </h1>
            <p style={{ marginTop: 12, fontSize: 13, opacity: 0.75 }}>
              Sube una foto de tu baño y descubre cómo quedaría con cualquier azulejo
              del catálogo.
            </p>
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button
                style={{
                  background: fields.primary,
                  color: '#fff',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: radius,
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Probar con IA
              </button>
              <button
                style={{
                  background: 'transparent',
                  color: fields.text,
                  border: `1px solid ${fields.text}22`,
                  padding: '10px 16px',
                  borderRadius: radius,
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Ver catálogo
              </button>
            </div>
          </div>

          {/* Card de azulejo */}
          <div
            style={{
              background: fields.surface,
              borderRadius: radius,
              overflow: 'hidden',
              border: `1px solid ${fields.text}11`,
            }}
          >
            <div
              style={{
                aspectRatio: '4 / 3',
                background: `linear-gradient(135deg, ${fields.accent}, ${fields.primary})`,
              }}
            />
            <div style={{ padding: '10px 12px' }}>
              <p
                style={{
                  margin: 0,
                  fontFamily: `'${fields.serif}', serif`,
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Alloy Azzurro
              </p>
              <p style={{ margin: '2px 0 0 0', fontSize: 11, opacity: 0.6 }}>
                60×120 · Pamesa · Consultar precio
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const style: Record<string, React.CSSProperties> = {
  wrapper: { marginTop: 16 },
  label: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    margin: '0 0 8px 0',
    color: 'var(--theme-elevation-700)',
  },
  preview: {
    border: '1px solid var(--theme-elevation-150)',
    borderRadius: 8,
    overflow: 'hidden',
    padding: '16px 20px 20px 20px',
  },
  previewHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    paddingBottom: 16,
    borderBottom: '1px solid currentColor',
    borderColor: 'rgba(0,0,0,0.07)',
    marginBottom: 16,
  },
  previewNav: { display: 'flex', gap: 16, fontSize: 12, opacity: 0.85, flex: 1 },
  previewBody: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: 24,
    alignItems: 'center',
  },
}
