/**
 * Normalización de taxonomías (marcas, colores…) para no acabar con el mismo
 * valor repetido con otro nombre.
 *
 * El problema es real y se reproduce solo: la IA lee "PAMESA cerámica" en la
 * portada de un catálogo y "Pamesa" en el pie de otro, y como el emparejado era
 * por nombre EXACTO salían dos marcas distintas con la mitad de los azulejos
 * cada una. Igual con los colores: "blanco con vetas grises" y "blanco con
 * vetas gris" son el mismo filtro para un cliente, pero acababan siendo dos
 * entradas del desplegable.
 *
 * Se usa tanto en el servidor (al publicar una importación) como en el cliente
 * (la zona de ventas avisa antes de crear un valor parecido a uno existente).
 */

/** Sin tildes, minúsculas, espacios colapsados. La base de toda comparación. */
export function normalizeKey(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Palabras que los catálogos añaden al nombre del fabricante y que no
 * distinguen una marca de otra: "PAMESA cerámica" y "Pamesa" son la misma.
 *
 * Ojo: solo se quitan si NO se comen el nombre entero — hay marcas que se
 * llaman literalmente así (una marca llamada "Cerámica" seguiría siendo
 * "cerámica", no la cadena vacía).
 */
const BRAND_NOISE_WORDS = new Set([
  'ceramica',
  'ceramicas',
  'ceramic',
  'ceramics',
  'porcelanico',
  'porcelanicos',
  'surfaces',
  'superficies',
  'grupo',
  'group',
  'sl',
  'sa',
  'slu',
  'sau',
  'sociedad',
  'limitada',
  'anonima',
  'by',
])

/**
 * "PAMESA cerámica, S.L." → "pamesa". Clave de comparación entre marcas.
 *
 * Además de quitar el ruido, junta las palabras: los catálogos escriben la
 * misma marca como "New Tiles" y "NewTiles", y sin esto serían dos.
 */
export function brandKey(name: string): string {
  // Los puntos fuera primero, si no "S.L." se parte en dos letras sueltas y
  // deja de reconocerse como forma jurídica.
  const base = normalizeKey((name || '').replace(/\./g, ''))
  const words = base.split(' ').filter(Boolean)
  const kept = words.filter((w) => !BRAND_NOISE_WORDS.has(w))
  // Si al quitar el ruido no queda nada, el "ruido" ERA el nombre.
  return (kept.length > 0 ? kept : words).join('')
}

/**
 * Colores canónicos del catálogo: los que sirven de filtro al cliente final.
 * La IA devuelve texto libre muy fino ("blanco con vetas grisáceas", "gris
 * perlado", "marfil/beige claro"); para filtrar, todos esos son un puñado de
 * colores. Cada entrada lista los términos que apuntan a ese color.
 */
const CANONICAL_COLORS: Array<{ name: string; terms: string[] }> = [
  { name: 'Blanco', terms: ['blanco', 'white', 'marfil', 'ivory', 'perla', 'perlado', 'nieve'] },
  { name: 'Beige', terms: ['beige', 'crema', 'cream', 'arena', 'sand', 'greige', 'topo', 'taupe'] },
  { name: 'Gris', terms: ['gris', 'grey', 'gray', 'plata', 'silver', 'cemento', 'antracita'] },
  { name: 'Negro', terms: ['negro', 'black', 'coal', 'carbon', 'grafito'] },
  { name: 'Marrón', terms: ['marron', 'brown', 'chocolate', 'nuez', 'roble', 'cerezo', 'madera', 'wood', 'bronce', 'cobre', 'copper'] },
  { name: 'Terracota', terms: ['terracota', 'terracotta', 'barro', 'arcilla', 'clay', 'teja', 'coral', 'rojo', 'red', 'naranja', 'orange', 'oxido'] },
  { name: 'Verde salvia', terms: ['verde', 'green', 'salvia', 'sage', 'oliva', 'mint'] },
  { name: 'Azul', terms: ['azul', 'blue', 'turquesa', 'azzurro', 'navy'] },
  { name: 'Amarillo', terms: ['amarillo', 'yellow', 'dorado', 'gold', 'oro', 'mostaza'] },
  { name: 'Rosa', terms: ['rosa', 'pink', 'salmon'] },
]

/**
 * Mapea un color en texto libre de la IA al color canónico del catálogo.
 *
 * Gana el término que aparece ANTES en el texto, porque el color base se dice
 * primero y los matices después: "blanco con vetas grises" es un blanco, no un
 * gris; "gris claro" es un gris. Si no reconoce nada, devuelve null y el
 * llamante decide (normalmente, crear el color tal cual).
 */
export function canonicalColorName(raw: string): string | null {
  const key = normalizeKey(raw)
  if (!key) return null
  let best: { name: string; at: number } | null = null
  for (const color of CANONICAL_COLORS) {
    for (const term of color.terms) {
      // Coincidencia por palabra completa: "coral" no debe activarse dentro de
      // "coralstone", ni "oro" dentro de "oscuro".
      const at = key.search(new RegExp(`\\b${term}\\b`))
      if (at === -1) continue
      if (!best || at < best.at) best = { name: color.name, at }
    }
  }
  return best ? best.name : null
}

/** Título en mayúscula inicial: "blanco roto" → "Blanco roto". */
export function titleCaseName(s: string): string {
  const t = (s || '').trim()
  if (!t) return t
  return t[0].toUpperCase() + t.slice(1)
}
