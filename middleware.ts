import { NextRequest, NextResponse } from 'next/server'
import { applySecurityHeaders, securityMiddleware } from '@/lib/security'

/**
 * Next.js 中间件
 * 在请求到达页面或 API 路由之前运行
 */
export function middleware(request: NextRequest) {
  // 安全检查
  const securityResponse = securityMiddleware(request)
  if (securityResponse) {
    return securityResponse
  }

  // 创建响应
  const response = NextResponse.next()

  // 应用安全头部
  applySecurityHeaders(response)

  // API 路由特殊处理
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // 设置 API 特定的头部
    response.headers.set('X-API-Version', '1.0.0')
    
    // 在生产环境中隐藏服务器信息
    if (process.env.NODE_ENV === 'production') {
      response.headers.delete('Server')
      response.headers.delete('X-Powered-By')
    }
  }

  // 健康检查端点不需要额外的安全措施
  if (request.nextUrl.pathname === '/api/health') {
    return response
  }

  return response
}

// 配置中间件运行的路径
export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，除了：
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico (网站图标)
     * - public 文件夹中的文件
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
