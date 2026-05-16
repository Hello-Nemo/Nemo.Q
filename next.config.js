/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    'pg',
    'pg-cloudflare'
  ],
  allowedDevOrigins: ['0.0.0.0', '127.0.0.1', 'localhost'],
  output: 'standalone',
  turbopack: {
    resolveAlias: {
      '@mariozechner/clipboard': './src/lib/mocks/clipboard-mock.js',
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias['@mariozechner/clipboard'] = false;
    }
    return config;
  },
};

export default nextConfig;

if (process.env.NODE_ENV === 'development') {
  import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
}
