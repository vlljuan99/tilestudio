'use client'

/**
 * Helpers de cliente contra la REST API de Payload para la zona de ventas.
 * Todo va con la cookie de sesión; los errores se normalizan a un Error con
 * mensaje legible (Payload devuelve {errors:[{message}]}).
 */

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80)
}

async function parse(res: Response) {
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const msg =
      data?.errors?.[0]?.data?.errors?.[0]?.message ||
      data?.errors?.[0]?.message ||
      data?.error ||
      `Error ${res.status}`
    throw new Error(msg)
  }
  return data
}

export async function apiGet(path: string) {
  return parse(await fetch(`/api${path}`, { credentials: 'include' }))
}

export async function apiCreate(collection: string, data: Record<string, unknown>) {
  const res = await parse(
    await fetch(`/api/${collection}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    }),
  )
  return res.doc
}

export async function apiUpdate(
  collection: string,
  id: number | string,
  data: Record<string, unknown>,
) {
  const res = await parse(
    await fetch(`/api/${collection}/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    }),
  )
  return res.doc
}

export async function apiDelete(collection: string, id: number | string) {
  return parse(
    await fetch(`/api/${collection}/${id}`, { method: 'DELETE', credentials: 'include' }),
  )
}

/** Sube una imagen a Media con progreso (XHR: fetch no da progreso de subida). */
export function uploadMedia(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ id: number | string; url: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/media')
    xhr.withCredentials = true
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && data?.doc?.id != null) resolve(data.doc)
        else reject(new Error(data?.errors?.[0]?.message || `No se pudo subir la imagen (${xhr.status}).`))
      } catch {
        reject(new Error(`No se pudo subir la imagen (${xhr.status}).`))
      }
    }
    xhr.onerror = () => reject(new Error('Fallo de red subiendo la imagen.'))
    const fd = new FormData()
    fd.append('file', file)
    fd.append('_payload', JSON.stringify({ alt: file.name }))
    xhr.send(fd)
  })
}

export type Option = { id: number | string; name: string }

/** Carga las opciones (id+name) de una colección de referencia, ordenadas. */
export async function loadOptions(collection: string, titleField = 'name'): Promise<Option[]> {
  const data = await apiGet(`/${collection}?limit=500&sort=${titleField}&depth=0`)
  return (data.docs || []).map((d: any) => ({ id: d.id, name: d[titleField] }))
}

/**
 * Crea un valor de referencia al vuelo (marca, formato, color…): siempre con
 * slug calculado porque no todas las colecciones lo autogeneran (Colores no).
 */
export async function createOption(
  collection: string,
  name: string,
  extra: Record<string, unknown> = {},
): Promise<Option> {
  const doc = await apiCreate(collection, { name, slug: slugify(name), ...extra })
  return { id: doc.id, name: doc.name }
}
