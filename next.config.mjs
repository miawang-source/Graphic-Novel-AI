/** @type {import('next').NextConfig} */
const nextConfig = {
  // ESLint 和 TypeScript 检查配置
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },

  // 图片优化配置
  images: {
    unoptimized: false, // 生产环境启用图片优化
    domains: ['gyafalegiojqnzyfasvb.supabase.co', '10.173.173.175'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '10.173.173.175',
        port: '8000',
        pathname: '/storage/v1/object/**',
      },
      {
        protocol: 'https',
        hostname: 'gyafalegiojqnzyfasvb.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },

  // 性能优化
  experimental: {
    optimizeCss: false, // 暂时禁用以避免 critters 依赖问题
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // API 路由配置 - 增加文件上传大小限制
  api: {
    bodyParser: {
      sizeLimit: '50mb', // 设置为 50MB 以支持大文件上传
    },
  },

  // 压缩配置
  compress: true,

  // 安全头部配置
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: process.env.NODE_ENV === 'production' ? process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com' : '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
    ]
  },

  // 重定向配置
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ]
  },

  // Webpack配置 - 支持canvas和pdfjs-dist
  webpack: (config, { isServer }) => {
    if (isServer) {
      // canvas需要特殊处理
      config.externals = config.externals || []
      if (Array.isArray(config.externals)) {
        config.externals.push('canvas')
      }
    }
    return config
  },
}

export default nextConfig
