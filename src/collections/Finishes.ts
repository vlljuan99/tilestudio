import type { CollectionConfig } from 'payload'

export const Finishes: CollectionConfig = {
  slug: 'finishes',
  labels: { singular: 'Acabado', plural: 'Acabados' },
  admin: {
    useAsTitle: 'name',
    group: 'Etiquetas',
    defaultColumns: ['name', 'slug'],
    description:
      'Cómo es la superficie del azulejo: mate, brillo, satinado, antideslizante… Los clientes pueden filtrar el catálogo por acabado.',
  },
  access: { read: () => true },
  fields: [
    { name: 'name', label: 'Nombre', type: 'text', required: true },
    { name: 'slug', label: 'Slug', type: 'text', required: true, unique: true },
    { name: 'description', label: 'Descripción', type: 'textarea' },
  ],
}
