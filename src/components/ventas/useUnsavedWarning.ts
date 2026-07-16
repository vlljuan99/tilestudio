'use client'

import { useEffect } from 'react'

/**
 * Avisa antes de cerrar/recargar la pestaña si el formulario tiene cambios sin
 * guardar. Los formularios de azulejo y ambiente son largos: perderlos por un
 * cierre accidental es tirar el trabajo de rellenarlos.
 *
 * Solo cubre la salida del navegador; la navegación interna de Next no se puede
 * interceptar de forma fiable en App Router, así que ahí no prometemos nada.
 */
export function useUnsavedWarning(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Chrome exige returnValue para mostrar el diálogo nativo.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
}
