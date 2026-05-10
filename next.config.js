/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    '@earendil-works/pi-ai',
    '@earendil-works/pi-coding-agent',
    '@earendil-works/pi-agent-core'
  ],
  allowedDevOrigins: ['0.0.0.0', '127.0.0.1', 'localhost'],
};

export default nextConfig;
