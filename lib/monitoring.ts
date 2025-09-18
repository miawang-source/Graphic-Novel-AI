/**
 * 性能监控和分析工具
 * 用于生产环境的性能跟踪和错误监控
 */

// 性能指标类型
interface PerformanceMetric {
  name: string
  value: number
  timestamp: number
  tags?: Record<string, string>
}

// 错误信息类型
interface ErrorInfo {
  message: string
  stack?: string
  url: string
  timestamp: number
  userAgent?: string
  userId?: string
}

// 性能监控类
class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private errors: ErrorInfo[] = []
  private maxMetrics = 1000
  private maxErrors = 100

  // 记录性能指标
  recordMetric(name: string, value: number, tags?: Record<string, string>) {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      tags
    }

    this.metrics.push(metric)

    // 保持数组大小在限制内
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift()
    }

    // 在生产环境中，这里可以发送到监控服务
    if (process.env.NODE_ENV === 'production') {
      this.sendMetricToService(metric)
    }
  }

  // 记录错误
  recordError(error: Error, context?: Record<string, any>) {
    const errorInfo: ErrorInfo = {
      message: error.message,
      stack: error.stack,
      url: typeof window !== 'undefined' ? window.location.href : 'server',
      timestamp: Date.now(),
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
      ...context
    }

    this.errors.push(errorInfo)

    // 保持数组大小在限制内
    if (this.errors.length > this.maxErrors) {
      this.errors.shift()
    }

    // 在生产环境中发送错误到监控服务
    if (process.env.NODE_ENV === 'production') {
      this.sendErrorToService(errorInfo)
    }

    // 开发环境中打印错误
    if (process.env.NODE_ENV === 'development') {
      console.error('Monitored Error:', errorInfo)
    }
  }

  // 获取性能统计
  getPerformanceStats() {
    const now = Date.now()
    const last5Minutes = now - 5 * 60 * 1000

    const recentMetrics = this.metrics.filter(m => m.timestamp > last5Minutes)
    
    const stats = {
      totalMetrics: this.metrics.length,
      recentMetrics: recentMetrics.length,
      totalErrors: this.errors.length,
      averageResponseTime: this.calculateAverageResponseTime(recentMetrics),
      errorRate: this.calculateErrorRate(),
      memoryUsage: this.getMemoryUsage()
    }

    return stats
  }

  // 计算平均响应时间
  private calculateAverageResponseTime(metrics: PerformanceMetric[]): number {
    const responseTimeMetrics = metrics.filter(m => m.name === 'api_response_time')
    
    if (responseTimeMetrics.length === 0) return 0
    
    const total = responseTimeMetrics.reduce((sum, m) => sum + m.value, 0)
    return Math.round(total / responseTimeMetrics.length)
  }

  // 计算错误率
  private calculateErrorRate(): number {
    const now = Date.now()
    const lastHour = now - 60 * 60 * 1000

    const recentErrors = this.errors.filter(e => e.timestamp > lastHour)
    const recentRequests = this.metrics.filter(m => 
      m.timestamp > lastHour && m.name === 'api_request'
    )

    if (recentRequests.length === 0) return 0

    return Math.round((recentErrors.length / recentRequests.length) * 100 * 100) / 100
  }

  // 获取内存使用情况
  private getMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      return {
        rss: Math.round(usage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
        external: Math.round(usage.external / 1024 / 1024) // MB
      }
    }
    return null
  }

  // 发送指标到监控服务
  private async sendMetricToService(metric: PerformanceMetric) {
    try {
      // 这里可以集成第三方监控服务，如 DataDog、New Relic 等
      // await fetch('/api/metrics', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(metric)
      // })
    } catch (error) {
      // 静默处理监控错误，避免影响主要功能
      console.warn('Failed to send metric to monitoring service:', error)
    }
  }

  // 发送错误到监控服务
  private async sendErrorToService(errorInfo: ErrorInfo) {
    try {
      // 这里可以集成错误监控服务，如 Sentry、Bugsnag 等
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorInfo)
      // })
    } catch (error) {
      // 静默处理监控错误
      console.warn('Failed to send error to monitoring service:', error)
    }
  }
}

// 全局监控实例
export const monitor = new PerformanceMonitor()

// API 响应时间监控装饰器
export function withPerformanceMonitoring<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  name: string
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now()
    
    try {
      const result = await fn(...args)
      const duration = Date.now() - startTime
      
      monitor.recordMetric('api_response_time', duration, { endpoint: name })
      monitor.recordMetric('api_request', 1, { endpoint: name, status: 'success' })
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      
      monitor.recordMetric('api_response_time', duration, { endpoint: name })
      monitor.recordMetric('api_request', 1, { endpoint: name, status: 'error' })
      monitor.recordError(error as Error, { endpoint: name })
      
      throw error
    }
  }) as T
}

// Web Vitals 监控（客户端）
export function initWebVitalsMonitoring() {
  if (typeof window === 'undefined') return

  // 监控 Core Web Vitals (可选功能)
  // 注意：需要安装 web-vitals 包才能使用此功能
  // npm install web-vitals

  // 暂时禁用 Web Vitals 监控以避免依赖问题
  // 在生产环境中可以根据需要启用
  console.debug('Web Vitals monitoring disabled - install web-vitals package to enable')

  // 监控未捕获的错误
  window.addEventListener('error', (event) => {
    monitor.recordError(new Error(event.message), {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    })
  })

  // 监控未处理的 Promise 拒绝
  window.addEventListener('unhandledrejection', (event) => {
    monitor.recordError(new Error(event.reason), {
      type: 'unhandledrejection'
    })
  })
}

// 导出监控统计 API
export function getMonitoringStats() {
  return monitor.getPerformanceStats()
}
