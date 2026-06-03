import type { CollectionConfig } from 'payload'

export const Rooms: CollectionConfig = {
  slug: 'rooms',
  labels: { singular: 'Estancia', plural: 'Estancias' },
  admin: {
    useAsTitle: 'name',
    group: 'Taxonomías',
    description: 'Estancias para clasificar y filtrar el catálogo.',
  },
  access: { read: () => true },
  fields: [
    { name: 'name', label: 'Nombre', type: 'text', required: true },
    { name: 'slug', label: 'Slug', type: 'text', required: true, unique: true },
  ],
}
