/**
 * Helper para auto-generar slugs desde el nombre.
 *
 * Uso típico en una colección:
 *   { name: 'slug', type: 'text', unique: true, ...autoSlug() }
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

/**
 * Devuelve el spread de admin + hooks para que el campo slug se auto-rellene
 * desde el campo `name` cuando se deja vacío. Editable manualmente si el
 * usuario quiere una URL específica.
 */
export function autoSlugFrom(sourceField = 'name') {
  return {
    admin: {
      position: 'sidebar' as const,
      description:
        'Es lo que aparece en la dirección web pública. Se rellena solo a partir del nombre — solo cámbialo si tienes un motivo.',
    },
    hooks: {
      beforeChange: [
        ({ data, value }: { data?: Record<string, any>; value?: string }) => {
          if (value && value.trim()) return slugify(value)
          if (data?.[sourceField]) return slugify(String(data[sourceField]))
          return value
        },
      ],
    },
  }
}
