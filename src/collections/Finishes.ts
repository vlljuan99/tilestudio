import type { CollectionConfig } from 'payload'

export const Finishes: CollectionConfig = {
  slug: 'finishes',
  labels: { singular: 'Acabado', plural: 'Acabados' },
  admin: {
    useAsTitle: 'name',
    group: 'Taxonomías',
    defaultColumns: ['name', 'slug'],
  },
  access: { read: () => true },
  fields: [
    { name: 'name', label: 'Nombre', type: 'text', required: true },
    { name: 'slug', label: 'Slug', type: 'text', required: true, unique: true },
    { name: 'description', label: 'Descripción', type: 'textarea' },
  ],
}
