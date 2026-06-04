import type { CollectionConfig } from 'payload'

export const Formats: CollectionConfig = {
  slug: 'formats',
  labels: { singular: 'Formato', plural: 'Formatos' },
  admin: {
    useAsTitle: 'name',
    group: 'Etiquetas',
    defaultColumns: ['name', 'widthCm', 'heightCm', 'slug'],
    description:
      'Las medidas del azulejo en centímetros (60x60, 30x90, 120x120…). Los clientes pueden filtrar el catálogo por tamaño.',
  },
  access: { read: () => true },
  fields: [
    {
      name: 'name',
      label: 'Nombre',
      type: 'text',
      required: true,
      admin: { description: 'Ejemplo: 60x60, 30x90, hexagonal 25.' },
    },
    { name: 'slug', label: 'Slug', type: 'text', required: true, unique: true },
    {
      type: 'row',
      fields: [
        { name: 'widthCm', label: 'Ancho (cm)', type: 'number' },
        { name: 'heightCm', label: 'Alto (cm)', type: 'number' },
      ],
    },
  ],
}
