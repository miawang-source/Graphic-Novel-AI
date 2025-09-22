import { NextResponse } from 'next/server'

/**
 * API 工具函数
 * 提供统一的错误处理、日志记录和响应格式
 */

// 日志级别
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

// API 错误类型
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = 'APIError'
  }
}

// 日志记录函数
export function log(level: LogLevel, message: string, data?: any) {
  const timestamp = new Date().toISOString()
  const logData = {
    timestamp,
    level,
    message,
    ...(data && { data })
  }

  // 在生产环境中，这里可以集成专业的日志服务
  if (process.env.NODE_ENV === 'production') {
    // 只在生产环境记录 WARN 和 ERROR 级别的日志
    if (level === LogLevel.WARN || level === LogLevel.ERROR) {
      console.log(JSON.stringify(logData))
    }
  } else {
    // 开发环境记录所有日志
    console.log(`[${level.toUpperCase()}] ${message}`, data || '')
  }
}

// 统一的错误响应处理
export function handleAPIError(error: unknown, context?: string): NextResponse {
  const timestamp = new Date().toISOString()
  
  if (error instanceof APIError) {
    log(LogLevel.ERROR, `API Error in ${context || 'unknown'}`, {
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      details: error.details
    })

    return NextResponse.json({
      error: {
        message: error.message,
        code: error.code,
        timestamp,
        ...(process.env.NODE_ENV === 'development' && { details: error.details })
      }
    }, { status: error.statusCode })
  }

  // 处理其他类型的错误
  const message = error instanceof Error ? error.message : 'Internal server error'
  
  log(LogLevel.ERROR, `Unexpected error in ${context || 'unknown'}`, {
    message,
    stack: error instanceof Error ? error.stack : undefined
  })

  return NextResponse.json({
    error: {
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
      timestamp,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: error instanceof Error ? error.stack : undefined 
      })
    }
  }, { status: 500 })
}

// 成功响应处理
export function handleAPISuccess(data: any, message?: string, statusCode: number = 200): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    ...(message && { message }),
    timestamp: new Date().toISOString()
  }, { status: statusCode })
}

// 验证必需的环境变量
export function validateEnvVars(requiredVars: string[]): void {
  const missing = requiredVars.filter(varName => !process.env[varName])
  
  if (missing.length > 0) {
    throw new APIError(
      `Missing required environment variables: ${missing.join(', ')}`,
      500,
      'MISSING_ENV_VARS',
      { missing }
    )
  }
}

// 请求体验证
export async function validateRequestBody(request: Request, requiredFields: string[]): Promise<any> {
  let body: any
  
  try {
    body = await request.json()
  } catch (error) {
    throw new APIError('Invalid JSON in request body', 400, 'INVALID_JSON')
  }

  const missing = requiredFields.filter(field => !(field in body) || body[field] === undefined)
  
  if (missing.length > 0) {
    throw new APIError(
      `Missing required fields: ${missing.join(', ')}`,
      400,
      'MISSING_FIELDS',
      { missing, received: Object.keys(body) }
    )
  }

  return body
}

// 速率限制检查（简单实现）
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  identifier: string, 
  maxRequests: number = 100, 
  windowMs: number = 60000
): boolean {
  const now = Date.now()
  const windowStart = now - windowMs
  
  const current = rateLimitMap.get(identifier)
  
  if (!current || current.resetTime < windowStart) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (current.count >= maxRequests) {
    return false
  }
  
  current.count++
  return true
}

// 清理过期的速率限制记录
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetTime < now) {
      rateLimitMap.delete(key)
    }
  }
}, 60000) // 每分钟清理一次

// 获取客户端 IP 地址
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  return 'unknown'
}

// API 响应缓存控制
export function setCacheHeaders(response: NextResponse, maxAge: number = 0): NextResponse {
  if (maxAge > 0) {
    response.headers.set('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}`)
  } else {
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  }

  return response
}

// OpenRouter API 错误处理
export function handleOpenRouterError(response: Response, errorData: any): string {
  let errorMessage = ""

  switch (response.status) {
    case 401:
      errorMessage = "API密钥无效或已过期。请检查OpenRouter API密钥配置。"
      break
    case 403:
      errorMessage = "API访问被拒绝。可能是密钥权限不足或账户余额不足。"
      break
    case 429:
      errorMessage = "API请求频率过高，请稍后重试。"
      break
    case 500:
      errorMessage = "OpenRouter服务器内部错误，请稍后重试。"
      break
    case 502:
    case 503:
    case 504:
      errorMessage = "OpenRouter服务暂时不可用，请稍后重试。"
      break
    default:
      const details = errorData?.error?.message || errorData?.message || JSON.stringify(errorData)
      errorMessage = `OpenRouter API错误 (${response.status}): ${details}`
  }

  return errorMessage
}

// 验证OpenRouter API密钥
export function validateOpenRouterKey(apiKey: string | undefined): boolean {
  if (!apiKey) {
    return false
  }

  // OpenRouter API密钥格式验证
  return apiKey.startsWith('sk-or-v1-') && apiKey.length > 20
}

// 智能JSON修复和解析
export function parseAIResponse(response: string): any {
  if (!response || typeof response !== 'string') {
    throw new Error('Invalid response format')
  }

  // 尝试多种解析策略
  const strategies = [
    // 策略1: 直接解析
    () => JSON.parse(response.trim()),

    // 策略2: 提取JSON代码块
    () => {
      const match = response.match(/```json\s*([\s\S]*?)\s*```/)
      if (match) return JSON.parse(match[1].trim())
      throw new Error('No JSON code block found')
    },

    // 策略3: 提取第一个JSON对象
    () => {
      const match = response.match(/\{[\s\S]*\}/)
      if (match) return JSON.parse(match[0])
      throw new Error('No JSON object found')
    },

    // 策略4: 清理和修复常见问题
    () => {
      let cleaned = response
        .replace(/```json|```/g, '') // 移除代码块标记
        .replace(/\n/g, ' ') // 移除换行符
        .replace(/\s+/g, ' ') // 合并空格
        .trim()

      const start = cleaned.indexOf('{')
      const end = cleaned.lastIndexOf('}')

      if (start !== -1 && end !== -1 && end > start) {
        cleaned = cleaned.substring(start, end + 1)
        // 修复常见的JSON错误
        cleaned = cleaned
          .replace(/,(\s*[}\]])/g, '$1') // 移除多余逗号
          .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // 为键名添加引号

        return JSON.parse(cleaned)
      }
      throw new Error('Cannot extract valid JSON structure')
    },

    // 策略5: 容错解析（最后的尝试）
    () => {
      // 尝试构建一个基本的有效结构
      const fallback: {
        characters: Array<{ name: string; description: string; role_type?: string }>;
        scenes: Array<{ name: string; description: string }>;
        scriptId: string;
      } = {
        characters: [],
        scenes: [],
        scriptId: `script_${Date.now()}`
      }

      // 尝试从响应中提取一些基本信息
      const lines = response.split('\n')
      for (const line of lines) {
        if (line.includes('角色') || line.includes('character')) {
          fallback.characters.push({
            name: '提取的角色',
            description: line.trim(),
            role_type: 'main'
          })
        }
        if (line.includes('场景') || line.includes('scene')) {
          fallback.scenes.push({
            name: '提取的场景',
            description: line.trim()
          })
        }
      }

      return fallback
    }
  ]

  // 依次尝试每种策略
  for (let i = 0; i < strategies.length; i++) {
    try {
      const result = strategies[i]()
      console.log(`[DEBUG] JSON解析成功，使用策略${i + 1}`)
      return result
    } catch (error) {
      console.log(`[DEBUG] 策略${i + 1}失败:`, error instanceof Error ? error.message : error)
      if (i === strategies.length - 1) {
        throw new Error(`所有JSON解析策略都失败了。原始响应: ${response.substring(0, 200)}...`)
      }
    }
  }
}
