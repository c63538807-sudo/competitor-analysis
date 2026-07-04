/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
};

// Only enable PWA when the module is available (skip on Railway)
let config = nextConfig;
try {
  const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: true, // Disable PWA completely during build to avoid issues
  });
  config = withPWA(nextConfig);
} catch {
  // next-pwa not available, use plain config
}

module.exports = config;
