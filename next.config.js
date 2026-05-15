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
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
