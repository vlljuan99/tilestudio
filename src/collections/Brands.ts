import type { CollectionConfig } from 'payload'

export const Brands: CollectionConfig = {
  slug: 'brands',
  labels: { singular: 'Marca', plural: 'Marcas' },
  admin: {
    useAsTitle: 'name',
    group: 'Catálogo',
    defaultColumns: ['name', 'slug'],
  },
  access: { read: () => true },
  fields: [
    { name: 'name', label: 'Nombre', type: 'text', required: true },
    { name: 'slug', label: 'Slug', type: 'text', required: true, unique: true },
    { name: 'description', label: 'Descripción', type: 'textarea' },
    { name: 'logo', label: 'Logo', type: 'upload', relationTo: 'media' },
  ],
}
