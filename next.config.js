/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    '@earendil-works/pi-ai',
    '@earendil-works/pi-coding-agent',
    '@earendil-works/pi-agent-core',
    'pg',
    'pg-cloudflare'
  ],
  allowedDevOrigins: ['0.0.0.0', '127.0.0.1', 'localhost'],
  output: 'standalone',
  outputFileTracingIncludes: {
    '/api/chat': ['./package.json', './skills/**/*', './src/lib/prompts/**/*'],
    '/api/query/execute-plan': ['./package.json', './skills/**/*'],
  },
};

export default nextConfig;

if (process.env.NODE_ENV === 'development') {
  import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
}
