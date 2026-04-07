/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@whiskeysockets/baileys', 'pino', '@hapi/boom'],
  },
  webpack: (config) => {
    config.externals = config.externals || []
    config.externals.push({
      bufferutil: 'commonjs bufferutil',
      'utf-8-validate': 'commonjs utf-8-validate',
    })
    return config
  },
}

module.exports = nextConfig
