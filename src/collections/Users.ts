import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'Usuario',
    plural: 'Usuarios',
  },
  admin: {
    useAsTitle: 'email',
    group: 'Sistema',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      label: 'Nombre',
      type: 'text',
    },
    {
      name: 'role',
      label: 'Rol',
      type: 'select',
      defaultValue: 'editor',
      options: [
        { label: 'Administrador', value: 'admin' },
        { label: 'Editor', value: 'editor' },
      ],
    },
  ],
}
