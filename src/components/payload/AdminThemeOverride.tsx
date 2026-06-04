'use client'

import { useEffect } from 'react'

/**
 * Aplica al admin la paleta de colores guardada en SiteSettings.
 * Se ejecuta tras login (cuando ya tenemos sesión). Al cambiar los colores
 * desde el formulario de Configuración → Apariencia y guardar, recarga la
 * página y vuelve a aplicarse.
 *
 * Mapea los colores de marca a las CSS variables que el admin de Payload usa
 * internamente (--theme-success-500, --theme-bg, --theme-text, etc.).
 */
export default function AdminThemeOverride({ children }: { children?: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false

    async function apply() {
      try {
        const res = await fetch('/api/globals/site-settings?depth=0', {
          credentials: 'include',
        })
        if (!res.ok) return
        const s = await res.json()
        if (cancelled) return

        const primary: string | undefined = s.colorPrimary
        const accent: string | undefined = s.colorAccent
        const background: string | undefined = s.colorBackground
        const text: string | undefined = s.colorText

        const root = document.documentElement

        // Solo override si tenemos hex válido. Si no, dejamos los defaults
        // de custom.scss (paleta cálida espresso).
        const setVar = (name: string, value?: string) => {
          if (value && /^#[0-9a-fA-F]{6}$/.test(value)) {
            root.style.setProperty(name, value)
          }
        }

        // Color principal (botones primarios, links activos)
        setVar('--theme-success-500', primary)
        if (primary) {
          setVar('--theme-success-750', shiftLightness(primary, -0.1))
          setVar('--theme-success-50', shiftLightness(primary, 0.45))
        }

        // Acento → error tone (errores y badges del admin usan --theme-error-*)
        setVar('--theme-error-500', accent)
        if (accent) {
          setVar('--theme-error-750', shiftLightness(accent, -0.1))
        }

        // Fondos: derivar elevaciones del color de fondo
        setVar('--theme-bg', background)
        if (background) {
          setVar('--theme-elevation-50', shiftLightness(background, 0.015))
          setVar('--theme-elevation-100', shiftLightness(background, -0.02))
          setVar('--theme-elevation-150', shiftLightness(background, -0.05))
          setVar('--theme-elevation-200', shiftLightness(background, -0.08))
        }

        // Texto
        setVar('--theme-text', text)
        if (text) {
          setVar('--theme-elevation-700', shiftLightness(text, 0.15))
          setVar('--theme-elevation-500', shiftLightness(text, 0.45))
        }
      } catch {
        // Silencioso: si falla, queda la paleta cálida por defecto
      }
    }

    apply()
    return () => {
      cancelled = true
    }
  }, [])

  return <>{children}</>
}

function shiftLightness(hex: string, delta: number): string {
  const c = hex.replace('#', '')
  if (c.length !== 6) return hex
  let r = parseInt(c.slice(0, 2), 16) / 255
  let g = parseInt(c.slice(2, 4), 16) / 255
  let b = parseInt(c.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  const nl = Math.max(0, Math.min(1, l + delta))
  function hue2rgb(p: number, q: number, t: number) {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  if (s === 0) {
    const v = Math.round(nl * 255)
    return '#' + [v, v, v].map((x) => x.toString(16).padStart(2, '0')).join('')
  }
  const q = nl < 0.5 ? nl * (1 + s) : nl + s - nl * s
  const p = 2 * nl - q
  const hh = h / 360
  const nr = Math.round(hue2rgb(p, q, hh + 1 / 3) * 255)
  const ng = Math.round(hue2rgb(p, q, hh) * 255)
  const nb = Math.round(hue2rgb(p, q, hh - 1 / 3) * 255)
  return '#' + [nr, ng, nb].map((x) => x.toString(16).padStart(2, '0')).join('')
}
