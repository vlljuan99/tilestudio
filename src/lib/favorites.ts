'use client'

import { useCallback, useEffect, useState } from 'react'

// Favoritos sin registro: slugs de azulejos en localStorage. El evento
// propio mantiene sincronizados header, cards y página de favoritos.
const STORAGE_KEY = 'tilestudio:favoritos'
const CHANGE_EVENT = 'tilestudio:favoritos-changed'

function readFavorites(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : []
  } catch {
    return []
  }
}

function writeFavorites(slugs: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs))
  } catch {
    // localStorage lleno o bloqueado: el toggle simplemente no persiste
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

export function useFavorites() {
  // Arranca vacío también en cliente para que la hidratación coincida con el
  // HTML del servidor; el estado real se carga en el efecto.
  const [slugs, setSlugs] = useState<string[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const sync = () => setSlugs(readFavorites())
    sync()
    setReady(true)
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const toggle = useCallback((slug: string) => {
    const current = readFavorites()
    const next = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug]
    writeFavorites(next)
  }, [])

  return {
    slugs,
    ready,
    count: slugs.length,
    has: useCallback((slug: string) => slugs.includes(slug), [slugs]),
    toggle,
  }
}
