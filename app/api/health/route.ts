import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * 健康检查 API
 * 用于监控系统状态和依赖服务
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      responseTime: 0,
      checks: {
        database: { status: 'unknown' as string, responseTime: 0, error: undefined as string | undefined },
        openrouter: { status: 'unknown' as string, responseTime: 0, error: undefined as string | undefined },
      }
    }

    // 检查数据库连接
    try {
      const dbStartTime = Date.now()
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseKey) {
        health.checks.database = {
          status: 'error',
          responseTime: 0,
          error: 'Missing Supabase configuration'
        }
      } else {
        const supabase = createClient(supabaseUrl, supabaseKey)
        const { data, error } = await supabase
          .from('scripts')
          .select('count')
          .limit(1)
          .single()

        health.checks.database = {
          status: error ? 'error' : 'healthy',
          responseTime: Date.now() - dbStartTime,
          error: error?.message
        }
      }
    } catch (error) {
      health.checks.database = {
        status: 'error',
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Database check failed'
      }
    }

    // 检查 OpenRouter API
    try {
      const apiStartTime = Date.now()
      const openrouterKey = process.env.OPENROUTER_API_KEY

      if (!openrouterKey) {
        health.checks.openrouter = {
          status: 'error',
          responseTime: 0,
          error: 'Missing OpenRouter API key'
        }
      } else {
        // 简单的 API 可用性检查
        const response = await fetch('https://openrouter.ai/api/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${openrouterKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(5000) // 5秒超时
        })

        health.checks.openrouter = {
          status: response.ok ? 'healthy' : 'error',
          responseTime: Date.now() - apiStartTime,
          error: response.ok ? undefined : `HTTP ${response.status}`
        }
      }
    } catch (error) {
      health.checks.openrouter = {
        status: 'error',
        responseTime: 0,
        error: error instanceof Error ? error.message : 'OpenRouter check failed'
      }
    }

    // 计算总体状态
    const hasErrors = Object.values(health.checks).some(check => check.status === 'error')
    if (hasErrors) {
      health.status = 'degraded'
    }

    // 添加总响应时间
    health.responseTime = Date.now() - startTime

    // 根据状态返回适当的 HTTP 状态码
    const statusCode = health.status === 'healthy' ? 200 : 503

    return NextResponse.json(health, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed',
      responseTime: Date.now() - startTime
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  }
}

// 支持 HEAD 请求用于简单的存活检查
export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
