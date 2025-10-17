/**
 * 安全配置和工具函数
 * 用于生产环境的安全加固
 */

import { NextRequest, NextResponse } from 'next/server'

// 安全头部配置
export const SECURITY_HEADERS = {
  // 防止点击劫持
  'X-Frame-Options': 'DENY',
  
  // 防止 MIME 类型嗅探
  'X-Content-Type-Options': 'nosniff',
  
  // XSS 保护
  'X-XSS-Protection': '1; mode=block',
  
  // 引用策略
  'Referrer-Policy': 'origin-when-cross-origin',
  
  // 权限策略
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  
  // 严格传输安全（仅在 HTTPS 环境下）
  ...(process.env.NODE_ENV === 'production' && {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
  }),
  
  // 内容安全策略
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js 需要 unsafe-inline 和 unsafe-eval
    "style-src 'self' 'unsafe-inline'", // Tailwind CSS 需要 unsafe-inline
    "img-src 'self' data: blob: https:", // 添加 blob: 支持图片预览
    "font-src 'self' data:",
    "connect-src 'self' https://gyafalegiojqnzyfasvb.supabase.co https://openrouter.ai",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')
}

// 应用安全头部到响应
export function applySecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  return response
}

// 验证请求来源
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  
  // 在生产环境中验证来源
  if (process.env.NODE_ENV === 'production') {
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_SITE_URL,
      `https://${host}`,
      // 添加其他允许的域名
    ].filter(Boolean)
    
    if (origin && !allowedOrigins.includes(origin)) {
      return false
    }
  }
  
  return true
}

// 清理用户输入
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return ''
  }
  
  return input
    .trim()
    .replace(/[<>]/g, '') // 移除潜在的 HTML 标签
    .slice(0, 10000) // 限制长度
}

// 验证文件类型
export function validateFileType(filename: string, allowedTypes: string[]): boolean {
  const extension = filename.split('.').pop()?.toLowerCase()
  return extension ? allowedTypes.includes(extension) : false
}

// 验证文件大小
export function validateFileSize(size: number, maxSize: number = 10 * 1024 * 1024): boolean {
  return size <= maxSize // 默认最大 10MB
}

// API 密钥验证
export function validateAPIKey(apiKey: string | null): boolean {
  if (!apiKey) {
    return false
  }
  
  // 验证 API 密钥格式
  if (apiKey.startsWith('sk-or-v1-')) {
    return apiKey.length > 20 // OpenRouter API 密钥格式
  }
  
  return false
}

// 生成随机字符串
export function generateRandomString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  
  return result
}

// 哈希函数（简单实现）
export async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// 验证请求频率（简单实现）
const requestCounts = new Map<string, { count: number; resetTime: number }>()

export function checkRequestRate(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): boolean {
  const now = Date.now()
  const windowStart = now - windowMs
  
  const current = requestCounts.get(identifier)
  
  if (!current || current.resetTime < windowStart) {
    requestCounts.set(identifier, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (current.count >= maxRequests) {
    return false
  }
  
  current.count++
  return true
}

// 清理过期的请求计数
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of requestCounts.entries()) {
    if (value.resetTime < now) {
      requestCounts.delete(key)
    }
  }
}, 60000)

// 中间件：安全检查
export function securityMiddleware(request: NextRequest): NextResponse | null {
  // 验证来源
  if (!validateOrigin(request)) {
    return NextResponse.json(
      { error: 'Invalid origin' },
      { status: 403 }
    )
  }
  
  // 检查请求频率
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRequestRate(clientIP)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    )
  }
  
  return null // 继续处理请求
}
