/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/mcp/:path*',
        destination: '/api/mcp',
      },
    ];
  },
}

module.exports = nextConfig 