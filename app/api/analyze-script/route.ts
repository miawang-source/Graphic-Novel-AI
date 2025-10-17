// 临时修复文件 - 用于快速恢复功能
// 主要修复：JSON解析错误处理和代码结构

import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { handleOpenRouterError, validateOpenRouterKey, parseAIResponse } from "@/lib/api-utils"

// Vercel 运行时配置
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 最大执行时间 60 秒（Pro 计划）

// 预热函数，减少冷启动延迟
// 诊断 API：用于检查环境变量配置
export async function GET() {
  const apiKey = process.env.OPENROUTER_API_KEY
  const isValid = validateOpenRouterKey(apiKey)

  return NextResponse.json({
    status: "ready",
    timestamp: new Date().toISOString(),
    message: "Analyze script API is ready - v2.0",
    env: {
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey?.substring(0, 12) || 'not-set',
      apiKeyLength: apiKey?.length || 0,
      apiKeySuffix: apiKey?.substring(apiKey.length - 4) || 'not-set',
      isValidFormat: isValid,
      startsWithCorrectPrefix: apiKey?.startsWith('sk-or-v1-') || false,
      hasWhitespace: apiKey ? /\s/.test(apiKey) : false,
      trimmedLength: apiKey?.trim().length || 0
    }
  })
}

// 快速修复版本 - 简化错误处理
export async function POST(request: NextRequest) {
  // 记录请求开始时间，用于监控冷启动
  const startTime = Date.now()
  console.log("[DEBUG] Request started at:", new Date().toISOString())

  try {
    const { content, title, selectedModel, model } = await request.json()

    // 兼容前端传递的参数名（model 或 selectedModel）
    const modelParam = selectedModel || model

    // 基本验证
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: "请提供有效的剧本内容" }, { status: 400 })
    }

    // 检查内容大小（Vercel 限制 4.5MB）
    const contentSize = new Blob([content]).size
    const maxSize = 3 * 1024 * 1024 // 3MB 安全限制
    if (contentSize > maxSize) {
      console.error(`[ERROR] Content too large: ${contentSize} bytes`)
      return NextResponse.json({
        error: `剧本内容过大（${(contentSize / 1024 / 1024).toFixed(2)}MB），超过限制（3MB）。\n\n建议：\n1. 分段分析剧本\n2. 删除不必要的内容\n3. 压缩文本`,
        contentSize,
        maxSize
      }, { status: 413 })
    }

    // API密钥验证
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
    if (!validateOpenRouterKey(OPENROUTER_API_KEY)) {
      console.error("[ERROR] OpenRouter API Key not configured")
      return NextResponse.json({ 
        error: "API密钥未配置。请在 .env.local 文件中设置 OPENROUTER_API_KEY。",
        details: "请访问 https://openrouter.ai 获取API密钥"
      }, { status: 500 })
    }

    // 模型配置
    const modelConfigs = {
      'google/gemini-1.5-flash': { name: 'Google Gemini 1.5 Flash', contextLength: 1000000 },
      'google/gemini-1.5-pro': { name: 'Google Gemini 1.5 Pro', contextLength: 2000000 },
      'anthropic/claude-3.5-sonnet': { name: 'Claude 3.5 Sonnet', contextLength: 200000 }
    }

    // 确保有有效的模型选择 - 强制使用默认模型
    const finalSelectedModel = (modelParam && modelParam.trim()) ? modelParam : 'google/gemini-1.5-flash'
    const modelConfig = modelConfigs[finalSelectedModel as keyof typeof modelConfigs] || modelConfigs['google/gemini-1.5-flash']

    console.log("[DEBUG] Model selection:", {
      originalSelectedModel: selectedModel,
      originalModel: model,
      modelParam,
      finalSelectedModel,
      modelName: modelConfig.name
    })

    // 文本长度处理
    let processedContent = content.trim()
    let wasTruncated = false
    
    if (processedContent.length > 50000) {
      processedContent = processedContent.substring(0, 50000)
      wasTruncated = true
    }

    console.log("[DEBUG] Processing script analysis:", {
      title,
      contentLength: content.length,
      selectedModel: finalSelectedModel,
      modelName: modelConfig.name,
      wasTruncated
    })

    // 调用OpenRouter API（添加超时控制）
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60秒超时

    let aiResponse: string
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://v0.dev",
          "X-Title": "Comic Production Tool",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: finalSelectedModel,
          messages: [
            {
              role: "system",
              content: `你是一个专业的小说分析助手，专门为漫画制作提供角色和场景分析。你需要从小说文本中提取详细的角色信息和场景描述，为后续的美术创作提供充分的参考。

请严格按照JSON格式返回结果，不要添加任何解释文字。

角色描述要求（每个角色至少200字）：
1. 【基本信息】：性别、年龄、身份、职业、性格特点、背景故事
2. 【外貌特征】：身高体型、脸型轮廓、眼睛颜色形状、鼻子嘴唇、发型发色、肌肤特点、特殊标记疤痕
3. 【服装细节】：日常服装、正式场合服装、材质质感、颜色搭配、配饰细节、鞋履选择
4. 【特殊特征】：标志性动作、说话方式、特殊能力、武器道具、情感表达方式

场景描述要求（每个场景至少150字）：
1. 【环境设定】：具体地点名称、建筑风格特色、室内外布局、自然环境细节
2. 【时代背景】：历史时期、文化特色、科技水平、社会风貌
3. 【氛围营造】：情感基调、光线效果、色彩倾向、天气状况、音效环境
4. 【重要细节】：关键道具位置、装饰元素、标志性建筑、特殊符号标记`
            },
            {
              role: "user",
              content: `请分析以下小说内容，提取角色和场景信息，并严格按照JSON格式返回结果：

${processedContent}

请返回以下格式的JSON：
{
  "characters": [
    {
      "name": "角色名称",
      "description": "【基本信息】性别、年龄（具体数字）、身份职业、性格特点（至少3个特点）、背景故事。【外貌特征】身高体型（具体描述）、脸型轮廓、眼睛（颜色、形状、大小）、鼻子嘴唇特征、发型发色（详细描述）、肌肤特点、特殊标记。【服装细节】日常服装（材质、颜色、款式）、正式场合服装、配饰细节、鞋履选择。【特殊特征】标志性动作、说话方式、特殊能力、常用道具、情感表达特点。",
      "role_type": "main/supporting"
    }
  ],
  "scenes": [
    {
      "name": "场景名称",
      "description": "【环境设定】具体地点名称、建筑风格特色（材质、颜色、造型）、室内外布局、自然环境细节（植被、地形、水体）。【时代背景】历史时期、文化特色、科技水平、社会风貌。【氛围营造】情感基调、光线效果（明暗、色温）、色彩倾向、天气状况、环境音效。【重要细节】关键道具位置、装饰元素、标志性建筑特征、特殊符号标记。"
    }
  ],
  "scriptId": "${crypto.randomUUID()}"
}

重要要求：
1. 角色描述必须详细具体，每个角色至少200字，包含足够的视觉信息用于美术创作
2. 场景描述必须有画面感，每个场景至少150字，便于场景设计和绘制
3. 严格按照JSON格式，确保所有字符串都用双引号包围
4. 描述中如有引号请使用转义字符
5. 不要省略任何细节，越详细越好，这是为专业漫画制作提供参考
6. 每个角色和场景都要充分挖掘文本中的信息，补充合理的细节`
            }
          ],
          max_tokens: 12000,
          temperature: 0.3
        }),
      })

      clearTimeout(timeoutId) // 清除超时定时器

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = handleOpenRouterError(response, errorData)
        throw new Error(errorMessage)
      }

      const data = await response.json()
      aiResponse = data.choices[0]?.message?.content

      if (!aiResponse) {
        throw new Error("AI分析失败，未获得有效响应")
      }
    } catch (fetchError) {
      clearTimeout(timeoutId) // 确保清除超时定时器

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error("请求超时，请稍后重试或使用更短的文本")
      }
      throw fetchError
    }

    console.log("[DEBUG] AI Response received:", aiResponse?.substring(0, 500) + "...")

    // 使用智能JSON解析
    let analysisResult
    try {
      analysisResult = parseAIResponse(aiResponse)
      console.log("[DEBUG] JSON解析成功")
    } catch (parseError) {
      console.error("[DEBUG] JSON解析失败:", parseError)
      
      // 返回友好的错误信息
      return NextResponse.json({
        error: `AI模型返回的响应格式无法解析。\n\n建议：\n1. 稍后重试\n2. 尝试使用其他模型\n3. 简化输入文本`,
        canRetry: true,
        modelUsed: finalSelectedModel
      }, { status: 422 })
    }

    // 验证结果格式
    if (!analysisResult.characters || !analysisResult.scenes) {
      return NextResponse.json({
        error: "AI分析结果格式不完整",
        debug: {
          hasCharacters: !!analysisResult.characters,
          hasScenes: !!analysisResult.scenes
        }
      }, { status: 500 })
    }

    // 保存到数据库
    try {
      const supabase = createServerClient()
      const { error: dbError } = await supabase
        .from('scripts')
        .insert({
          id: analysisResult.scriptId,
          title: title || "未知剧本",
          content: processedContent,
          analysis_result: analysisResult,
          created_at: new Date().toISOString()
        })

      if (dbError) {
        console.error("Database error:", dbError)
      }
    } catch (dbError) {
      console.error("Database error:", dbError)
    }

    // 返回成功结果
    const totalTime = Date.now() - startTime
    console.log(`[DEBUG] Request completed in ${totalTime}ms`)

    return NextResponse.json({
      success: true,
      data: analysisResult,
      title: title || "未知剧本",
      scriptId: analysisResult.scriptId,
      truncated: wasTruncated,
      performance: {
        totalTime,
        timestamp: new Date().toISOString()
      },
      ...(wasTruncated && {
        truncationInfo: {
          originalLength: content.length,
          processedLength: processedContent.length,
          message: "文本过长已自动截断，分析结果基于截断后的内容"
        }
      })
    })

  } catch (error) {
    console.error("Script analysis error:", error)
    
    let errorMessage = "分析失败，请重试"
    let statusCode = 500

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = `请求超时。建议：1) 使用更短的文本 2) 稍后重试`
        statusCode = 408
      } else if (error.message.includes('fetch')) {
        errorMessage = `网络连接错误。建议稍后重试。`
        statusCode = 503
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json({
      error: errorMessage,
    }, { status: statusCode })
  }
}
