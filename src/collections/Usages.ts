import type { CollectionConfig } from 'payload'

export const Usages: CollectionConfig = {
  slug: 'usages',
  labels: { singular: 'Uso', plural: 'Usos' },
  admin: {
    useAsTitle: 'name',
    group: 'Taxonomías',
    description: 'Tipo de uso recomendado (suelo interior, pared baño, exterior...).',
  },
  access: { read: () => true },
  fields: [
    { name: 'name', label: 'Nombre', type: 'text', required: true },
    { name: 'slug', label: 'Slug', type: 'text', required: true, unique: true },
  ],
}
