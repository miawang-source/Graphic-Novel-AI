/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 增加服务器端的最大请求体大小
    serverActions: {
      bodySizeLimit: '600mb',
    },
  },
}

module.exports = nextConfig

