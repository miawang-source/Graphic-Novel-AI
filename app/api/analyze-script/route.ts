import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

// 支持的长文本模型配置
const SUPPORTED_MODELS = {
  "openrouter/sonoma-dusk-alpha": {
    name: "Sonoma Dusk Alpha",
    contextLength: 2000000,
    maxTokens: 8000,
    isFree: true,
    supportedParams: ["max_tokens", "response_format", "structured_outputs", "tool_choice", "tools"]
  },
  "google/gemini-pro-1.5": {
    name: "Google Gemini 1.5 Pro",
    contextLength: 2000000,
    maxTokens: 8000,
    isFree: false,
    supportedParams: ["frequency_penalty", "max_tokens", "presence_penalty", "response_format", "seed", "stop", "structured_outputs", "temperature", "tool_choice", "tools", "top_p"]
  },
  "qwen/qwen-plus-2025-07-28": {
    name: "Qwen Plus 0728",
    contextLength: 1000000,
    maxTokens: 8000,
    isFree: false,
    supportedParams: ["max_tokens", "presence_penalty", "response_format", "seed", "structured_outputs", "temperature", "tool_choice", "tools", "top_p"]
  }
}

const DEFAULT_MODEL = "openrouter/sonoma-dusk-alpha"

const ANALYSIS_PROMPT = `你是一个专业的小说内容分析助手，专门为美术创作提供详细的角色与场景描述。你的任务是从用户提供的小说内容中准确提取人物角色和场景信息，并转化为适合AI绘画的详细描述。注意必须按照格式要求返回结构化的JSON数据。

## 核心任务要求：

### 1. 角色分析要求
- 仔细分析小说文本，识别所有出现的人物角色
- 对于每个角色，需要从以下维度进行详细描述：

#### 角色基本信息
- **性别/年龄**：具体性别和年龄范围描述
- **身份职业**：角色的社会身份、职业或地位
- **性格特质**：主要性格特征和气质表现

#### 物理特征描述
- **身材比例**：详细的体型描述（高矮、胖瘦、体态特征）
- **面部特征**：脸型、五官比例、面部轮廓特点
- **发型**：发型样式、长度、颜色、质感、特殊造型
- **眼睛**：眼型、大小、颜色、神态特征、眼神表现
- **肌肤**：肤色、质感、特殊标记（疤痕、胎记等）

#### 服装细节（重点要求）
- **多套服装描述**：如果角色在不同场景有不同服装，必须分别详细描述
  * 服装1：[具体场景] - 详细的服装款式、颜色、材质、状态描述
  * 服装2：[具体场景] - 详细的服装款式、颜色、材质、状态描述
  * 服装3：[具体场景] - 详细的服装款式、颜色、材质、状态描述
- **配饰装备**：头饰、首饰、武器、道具、包包等的具体描述
- **服装风格**：时代特色、材质质感、颜色搭配的详细说明
- **穿着状态**：整洁程度、破损情况、特殊细节的具体描述

#### 特殊特征
- **显著标识**：最容易识别的外貌特征
- **动作姿态**：常见的动作习惯或典型姿势
- **特殊能力标志**：如果有超能力、魔法等的外在表现

### 2. 场景分析要求
- 识别故事发生的主要场景环境
- 详细描述场景的视觉要素：
  - **环境设定**：具体地点、建筑风格、自然环境
  - **时代背景**：历史时期、科技水平、文化特色
  - **氛围营造**：情绪基调、光线效果、色彩倾向
  - **细节元素**：重要道具、装饰物、环境特征

### 3. 创作补充原则（重要）
当小说中角色描述不够详细时，必须根据以下原则进行智能补充：

#### 面部特征补充规则
- **基于身份推断**：贵族→精致五官、优雅气质；平民→朴实面容、自然神态
- **基于性格推断**：温柔→柔和眼神、温和表情；冷酷→锐利眼神、冷峻面容
- **基于年龄推断**：年轻→光滑肌肤、明亮眼神；成熟→沉稳神态、岁月痕迹

#### 服装细节补充规则
- **基于场景推断**：医院→病号服、虚弱状态；宫廷→华贵服饰、精美头饰
- **基于身份推断**：皇室→金丝刺绣、珠宝装饰；平民→朴素布料、简单款式
- **基于时代推断**：古代→传统服饰、发髻头冠；现代→时尚服装、现代配饰

#### 其他补充原则
- **符合角色设定**：基于角色的身份、性格、所处时代进行逻辑推理
- **保持风格一致**：与小说整体风格和世界观保持统一
- **考虑实用性**：补充的描述要有利于AI绘画生成
- **细节丰富化**：即使原文简略，也要提供足够的视觉细节

### 4. 角色重要性判断
- **主角(main)**：故事核心人物、出场频率高、推动剧情发展
- **配角(supporting)**：次要人物、特定场景出现、辅助剧情发展

## 输出格式要求：

{
  "characters": [
    {
      "name": "角色名称",
      "description": "【基本信息】性别年龄、身份职业、性格特质的详细描述。【外貌特征】身材比例、面部特征（脸型、五官）、发型发色、眼睛特征、肌肤特点的具体描述。【服装细节】服装1：[场景]具体服装描述；服装2：[场景]具体服装描述；配饰装备的详细描述。【特殊特征】显著标识、动作姿态、特殊能力标志的描述。",
      "role_type": "main"
    }
  ],
  "scenes": [
    {
      "name": "场景名称",
      "description": "【环境设定】具体地点、建筑风格、自然环境的详细描述。【时代背景】历史时期、科技水平、文化特色的描述。【氛围营造】情绪基调、光线效果、色彩倾向的描述。【重要细节】关键道具、装饰元素、环境特色的具体描述。"
    }
  ]
}

## 重要格式要求：
1. **必须严格按照上述JSON格式返回数据**
2. **不要添加任何额外的文字说明或解释**
3. **确保JSON格式完全正确：**
   - 所有字符串都用双引号包围
   - 数组元素之间用逗号分隔
   - 对象属性之间用逗号分隔
   - 不要在最后一个元素后添加逗号
   - 确保所有括号正确匹配
4. **返回的内容必须是有效的JSON对象，以{开始，以}结束**
5. **字符串内容中如果包含引号，请使用转义字符\"**
6. **描述要具体生动，避免抽象概念**
7. **色彩、材质、光影效果要明确描述**
8. **若为补充推断，请在字符串末尾添加（推测补充）**`

export async function POST(request: NextRequest) {
  try {
    const { content, title, model } = await request.json()

    if (!content) {
      return NextResponse.json({ error: "请提供小说内容" }, { status: 400 })
    }

    // 移除最小长度限制，支持各种长度的文本
    if (content.length < 10) {
      return NextResponse.json({ error: "内容过短，请提供更多内容" }, { status: 400 })
    }

    // 验证和设置模型
    const selectedModel = model && SUPPORTED_MODELS[model as keyof typeof SUPPORTED_MODELS] ? model : DEFAULT_MODEL
    const modelConfig = SUPPORTED_MODELS[selectedModel as keyof typeof SUPPORTED_MODELS]

    console.log("[DEBUG] Processing script analysis:", {
      title: title || "未知",
      contentLength: content.length,
      selectedModel: selectedModel,
      modelName: modelConfig.name,
      contextLength: modelConfig.contextLength,
      contentPreview: content.substring(0, 100) + "..."
    })

    // 文本截断处理 - 确保不超过模型上下文限制
    let processedContent = content
    let wasTruncated = false

    // 估算tokens数量 (中文约1:1，英文约1:0.25的比例，保守估算为1:1.2)
    const estimatedTokens = Math.ceil(content.length * 1.2)
    const maxInputTokens = modelConfig.contextLength - modelConfig.maxTokens - 2000 // 预留输出和系统提示的空间

    // 根据不同模型设置不同的字符限制
    let reasonableMaxChars
    if (selectedModel.includes('sonoma')) {
      reasonableMaxChars = 1000000 // Sonoma模型：100万字符
    } else if (selectedModel.includes('gemini')) {
      reasonableMaxChars = 800000  // Gemini模型：80万字符
    } else {
      reasonableMaxChars = 500000  // 其他模型：50万字符
    }

    if (estimatedTokens > maxInputTokens || content.length > reasonableMaxChars) {
      // 计算需要截断到的字符数，取较小值确保稳定
      const maxCharsByTokens = Math.floor(maxInputTokens / 1.5) // 更保守的估算
      const maxChars = Math.min(maxCharsByTokens, reasonableMaxChars)

      // 直接从开头截断，不使用智能采样
      processedContent = content.substring(0, maxChars)
      wasTruncated = true

      console.log("[DEBUG] Text truncated from beginning:", {
        originalLength: content.length,
        truncatedLength: processedContent.length,
        estimatedOriginalTokens: estimatedTokens,
        maxInputTokens: maxInputTokens,
        modelContextLength: modelConfig.contextLength,
        reasonableMaxChars: reasonableMaxChars,
        maxChars: maxChars,
        modelName: modelConfig.name,
        truncationReason: content.length > reasonableMaxChars ? "Length limit" : "Token limit"
      })
    } else {
      console.log("[DEBUG] Text length OK:", {
        contentLength: content.length,
        estimatedTokens: estimatedTokens,
        maxInputTokens: maxInputTokens
      })
    }

    // 创建带超时的fetch请求 - 长文本需要更多时间
    const controller = new AbortController()
    const timeoutMs = wasTruncated || content.length > 20000 ? 300000 : 180000 // 长文本5分钟，短文本3分钟
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

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
        model: selectedModel,
        messages: [
          {
            role: "system",
            content: ANALYSIS_PROMPT,
          },
          {
            role: "user",
            content: `请分析以下小说内容，并严格按照JSON格式返回结果：

标题：${title || "未知"}

内容：
${processedContent}${wasTruncated ? '\n\n[注意：文本已从开头截断，请基于前半部分内容进行角色分析]' : ''}

特别要求：
1. 请控制响应长度，每个角色描述不超过500字
2. 场景描述简洁明了，重点突出关键特征
3. 确保返回完整有效的JSON格式
4. 不要添加任何解释文字
5. ${wasTruncated ? '内容已从开头截断，请重点分析前半部分出现的主要角色和场景' : '请优先分析主要角色和场景'}`,
          },
        ],
        // 对于长文本使用更保守的设置，确保响应稳定
        max_tokens: wasTruncated || content.length > 15000 ? 2500 :
                   content.length > 10000 ? 3500 : modelConfig.maxTokens,
        // 只添加模型支持的参数
        ...(modelConfig.supportedParams.includes('temperature') && {
          temperature: wasTruncated || content.length > 15000 ? 0.1 :
                      content.length > 10000 ? 0.3 : 0.7
        }),
        ...(modelConfig.supportedParams.includes('response_format') && { response_format: { type: "text" } }),
      }),
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("[DEBUG] OpenRouter API error:", {
        status: response.status,
        statusText: response.statusText,
        errorData: errorData,
        selectedModel: selectedModel,
        modelConfig: modelConfig,
        contentLength: processedContent.length,
        wasTruncated: wasTruncated
      })

      // 对于长文本提供特殊错误信息
      if (wasTruncated || content.length > 20000) {
        throw new Error(`长文本处理失败 (${content.length.toLocaleString()}字符)。建议：1) 将文档分段处理 2) 使用更短的文本 3) 稍后重试`)
      }

      throw new Error(`OpenRouter API error: ${response.status} - ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    const aiResponse = data.choices[0]?.message?.content

    console.log("[DEBUG] AI Response received:", aiResponse?.substring(0, 500) + "...")

    if (!aiResponse) {
      console.error("[DEBUG] No AI response content")
      throw new Error("AI分析失败，未获得有效响应")
    }

    // 尝试解析JSON响应
    let analysisResult
    try {
      let jsonStr = aiResponse.trim()

      // 尝试多种方式提取JSON
      // 1. 首先尝试提取```json代码块
      const jsonCodeBlockMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonCodeBlockMatch) {
        jsonStr = jsonCodeBlockMatch[1].trim()
        console.log("[DEBUG] Found JSON code block")
      } else {
        // 2. 尝试提取第一个完整的JSON对象
        const jsonObjectMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonObjectMatch) {
          jsonStr = jsonObjectMatch[0].trim()
          console.log("[DEBUG] Found JSON object")
        } else {
          // 3. 如果都没找到，尝试清理响应内容
          jsonStr = aiResponse
            .replace(/^[^{]*/, '') // 移除开头的非JSON内容
            .replace(/[^}]*$/, '') // 移除结尾的非JSON内容
            .trim()
          console.log("[DEBUG] Cleaned response")
        }
      }

      // JSON清理和修复 - 增强版
      jsonStr = jsonStr
        .replace(/,(\s*[}\]])/g, '$1') // 移除多余的逗号
        .replace(/\r\n/g, '\\n') // 处理Windows换行符
        .replace(/\n/g, '\\n') // 处理Unix换行符
        .replace(/\r/g, '\\n') // 处理Mac换行符
        .replace(/\t/g, '\\t') // 处理制表符
        .replace(/"/g, '\\"') // 转义所有双引号
        .replace(/\\"/g, '"') // 还原JSON结构中的引号
        .replace(/"([^"]*)":/g, '"$1":') // 修复键名
        .replace(/:\s*"([^"]*)"([,}\]])/g, ': "$1"$2') // 修复值

      console.log("[DEBUG] Extracted JSON string:", jsonStr?.substring(0, 300) + "...")

      analysisResult = JSON.parse(jsonStr)
      console.log("[DEBUG] Parsed result structure:", {
        hasCharacters: !!analysisResult.characters,
        hasScenes: !!analysisResult.scenes,
        charactersCount: analysisResult.characters?.length,
        scenesCount: analysisResult.scenes?.length
      })
    } catch (parseError) {
      console.error("[DEBUG] JSON解析失败:", parseError)
      console.error("[DEBUG] 原始AI响应:", aiResponse)

      // 尝试使用更宽松的解析方法
      try {
        // 移除所有换行符和多余空格，然后尝试修复常见的JSON错误
        let fixedJson = aiResponse
          .replace(/```json|```/g, '') // 移除代码块标记
          .replace(/\n/g, ' ') // 移除换行符
          .replace(/\s+/g, ' ') // 合并多个空格
          .trim()

        // 查找JSON对象的开始和结束
        const start = fixedJson.indexOf('{')
        const end = fixedJson.lastIndexOf('}')

        if (start !== -1 && end !== -1 && end > start) {
          fixedJson = fixedJson.substring(start, end + 1)
          analysisResult = JSON.parse(fixedJson)
          console.log("[DEBUG] 使用修复方法成功解析JSON")
        } else {
          throw new Error("无法找到有效的JSON结构")
        }
      } catch (secondParseError) {
        console.error("[DEBUG] 二次解析也失败:", secondParseError)

        // 尝试第三种方法：逐步清理和重构JSON
        try {
          console.log("[DEBUG] 尝试第三种JSON修复方法...")

          // 提取所有字符串内容，暂时替换为占位符
          const stringContents: string[] = []
          let tempJson = aiResponse

          // 先移除代码块标记
          tempJson = tempJson.replace(/```json|```/g, '')

          // 找到JSON对象的边界
          const jsonStart = tempJson.indexOf('{')
          const jsonEnd = tempJson.lastIndexOf('}')

          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            tempJson = tempJson.substring(jsonStart, jsonEnd + 1)

            // 简单的字符串内容替换，避免复杂的转义问题
            tempJson = tempJson.replace(/"description":\s*"([^"]*(?:"[^"]*)*[^"]*)"/g, (_match: string, content: string) => {
              const placeholder = `__STRING_${stringContents.length}__`
              // 清理描述内容中的问题字符
              const cleanContent = content
                .replace(/\r\n/g, ' ')
                .replace(/\n/g, ' ')
                .replace(/\r/g, ' ')
                .replace(/\t/g, ' ')
                .replace(/\s+/g, ' ')
                .replace(/"/g, '\\"')
                .trim()
              stringContents.push(cleanContent)
              return `"description": "${placeholder}"`
            })

            // 尝试解析简化后的JSON
            const tempResult = JSON.parse(tempJson)

            // 恢复字符串内容
            if (tempResult.characters) {
              tempResult.characters.forEach((char: any, _index: number) => {
                if (char.description && char.description.includes('__STRING_')) {
                  const match = char.description.match(/__STRING_(\d+)__/)
                  if (match) {
                    const stringIndex = parseInt(match[1])
                    char.description = stringContents[stringIndex]
                  }
                }
              })
            }

            analysisResult = tempResult
            console.log("[DEBUG] 第三种方法成功解析JSON")
          } else {
            throw new Error("无法找到有效的JSON结构")
          }
        } catch (thirdParseError) {
          console.error("[DEBUG] 第三种解析方法也失败:", thirdParseError)

          // 如果是截断的长文本，返回特殊错误信息
          if (wasTruncated) {
            return NextResponse.json(
              {
                error: `文本过长导致AI分析超时或响应不完整。\n\n原始文本：${content.length.toLocaleString()}字符\n已截断至：${processedContent.length.toLocaleString()}字符\n\n建议：\n1) 将文本分段处理\n2) 使用较短的文本\n3) 稍后重试`,
                truncated: true,
                originalLength: content.length,
                processedLength: processedContent.length
              },
              { status: 400 }
            )
          }
        }

        // 对于特定模型，返回更详细的错误信息
        console.log("[DEBUG] JSON解析失败，模型:", selectedModel)

        return NextResponse.json(
          {
            error: `AI模型 "${modelConfig.name}" 返回的响应格式无法解析。\n\n可能原因：\n1. 模型响应格式不符合JSON标准\n2. 响应内容被截断或不完整\n3. 模型对提示词的理解有偏差\n\n建议：\n1. 尝试使用其他模型（如 Sonoma Dusk Alpha 或 Gemini 1.5 Pro）\n2. 简化输入文本内容\n3. 稍后重试\n\n原始响应预览：\n${aiResponse?.substring(0, 200)}...`,
            modelUsed: selectedModel,
            modelName: modelConfig.name,
            responsePreview: aiResponse?.substring(0, 500)
          },
          { status: 422 }
        )
      }
    }

    // 验证响应格式
    if (!analysisResult.characters || !analysisResult.scenes) {
      console.error("[DEBUG] 格式验证失败:", {
        hasCharacters: !!analysisResult.characters,
        hasScenes: !!analysisResult.scenes,
        actualStructure: Object.keys(analysisResult)
      })
      return NextResponse.json({
        error: "AI分析结果格式不完整",
        debug: {
          hasCharacters: !!analysisResult.characters,
          hasScenes: !!analysisResult.scenes,
          actualKeys: Object.keys(analysisResult)
        }
      }, { status: 500 })
    }

    // 保存到数据库
    try {
      const supabase = createServerClient()

      // 创建剧本记录
      const { data: scriptData, error: scriptError } = await supabase
        .from("scripts")
        .insert({
          title: title || "未知剧本",
          content: content,
          analysis_result: analysisResult,
          character_count: analysisResult.characters?.length || 0,
          scene_count: analysisResult.scenes?.length || 0,
          analysis_status: 'completed'
        })
        .select()
        .single()

      if (scriptError) {
        console.error("Failed to save script:", scriptError)
      } else {
        console.log("[DEBUG] Script saved with ID:", scriptData.id)
        // 将scriptId添加到返回结果中
        analysisResult.scriptId = scriptData.id
      }
    } catch (dbError) {
      console.error("Database error:", dbError)
      // 不影响主要功能，继续返回结果
    }

    return NextResponse.json({
      success: true,
      data: analysisResult,
      title: title || "未知剧本",
      scriptId: analysisResult.scriptId, // 确保scriptId在顶层返回
      truncated: wasTruncated,
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

    // 处理不同类型的错误
    let errorMessage = "分析失败，请重试"
    let statusCode = 500

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = `请求超时。建议：1) 使用更短的文本 2) 将长文档分段处理 3) 稍后重试`
        statusCode = 408
      } else if (error.message.includes('fetch')) {
        errorMessage = `网络连接错误。建议稍后重试或使用更短的文本。`
        statusCode = 503
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: statusCode },
    )
  }
}
