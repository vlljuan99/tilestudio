import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // En dev con Payload embebido el optimizador de Next/Image puede dar problemas
    // (caché tras reinicios, Content-Disposition, etc.). Payload ya genera variantes
    // (thumb/card/hero) en upload, así que servirlas directas es suficiente.
    // En producción se puede reactivar con un dominio configurado.
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  experimental: {
    reactCompiler: false,
  },
  // Paquetes con binarios nativos que webpack no debe procesar.
  serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist', 'sharp'],
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
