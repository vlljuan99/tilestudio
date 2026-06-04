import type { CollectionConfig } from 'payload'

export const Colors: CollectionConfig = {
  slug: 'colors',
  labels: { singular: 'Color', plural: 'Colores' },
  admin: {
    useAsTitle: 'name',
    group: 'Etiquetas',
    defaultColumns: ['name', 'hex', 'slug'],
    description:
      'Colores principales por los que tus clientes pueden filtrar el catálogo (blanco, beige, gris, terracota…).',
  },
  access: { read: () => true },
  fields: [
    { name: 'name', label: 'Nombre', type: 'text', required: true },
    {
      name: 'slug',
      label: 'Slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'Identificador para URLs y filtros (ej: blanco-marfil).' },
    },
    {
      name: 'hex',
      label: 'Hex',
      type: 'text',
      admin: { description: 'Color hex para el swatch (#RRGGBB).' },
    },
  ],
}
