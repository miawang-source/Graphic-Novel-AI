import { type NextRequest, NextResponse } from "next/server"
import { handleOpenRouterError, validateOpenRouterKey } from "@/lib/api-utils"

export async function POST(request: NextRequest) {
  try {
    console.log("[DEBUG] image-generation API called")

    const body = await request.json()
    const { images, prompt, mode = "image-edit" } = body

    console.log("[DEBUG] Received prompt:", prompt)
    console.log("[DEBUG] Received images count:", images?.length || 0)
    console.log("[DEBUG] Generation mode:", mode)

    if (!prompt) {
      return NextResponse.json({ error: "No prompt provided" }, { status: 400 })
    }

    // 图像编辑模式需要图片，文生图模式不需要
    if (mode === "image-edit" && (!images || images.length === 0)) {
      return NextResponse.json({ error: "图像编辑模式需要选择图片" }, { status: 400 })
    }

    // 验证API密钥
    if (!validateOpenRouterKey(process.env.OPENROUTER_API_KEY)) {
      return NextResponse.json({
        error: "OpenRouter API密钥未配置或格式无效，请联系管理员"
      }, { status: 500 })
    }

    // 构建消息内容 - 根据模式调整提示词
    let enhancedPrompt = ""
    if (mode === "text-to-image") {
      enhancedPrompt = `请生成一张图片：${prompt}

重要：请直接生成图片，不要返回文字描述。我需要的是实际的图片文件，而不是文字说明。`
    } else {
      enhancedPrompt = `请生成一张图片：${prompt}

重要：请直接生成图片，不要返回文字描述。我需要的是实际的图片文件，而不是文字说明。`
    }

    const messageContent: any[] = [
      {
        type: "text",
        text: enhancedPrompt
      }
    ]

    // 只在有图片时添加图片到消息内容
    if (images && images.length > 0) {
      images.forEach((imageData: string) => {
        messageContent.push({
          type: "image_url",
          image_url: {
            url: imageData
          }
        })
      })
    }

    console.log("[DEBUG] Calling OpenRouter API with Gemini 2.5 Flash Image Preview (Nano Banana)...")

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: messageContent
          }
        ],
        modalities: ["image", "text"],  // 关键：启用图片生成功能
        max_tokens: 4000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("[ERROR] OpenRouter API error:", response.status, response.statusText)
      console.error("[ERROR] OpenRouter error details:", errorData)
      const errorMessage = handleOpenRouterError(response, errorData)
      throw new Error(errorMessage)
    }

    const data = await response.json()
    console.log("[DEBUG] OpenRouter response received:", JSON.stringify(data, null, 2))

    // 检查是否有choices数组
    if (!data.choices || !data.choices[0]) {
      console.error("[ERROR] No choices in response:", data)
      throw new Error("No choices in OpenRouter response")
    }

    const choice = data.choices[0]
    const message = choice.message

    if (!message) {
      console.error("[ERROR] No message in choice:", choice)
      throw new Error("No message in choice")
    }

    console.log("[DEBUG] Message structure:", JSON.stringify(message, null, 2))

    // 首先检查OpenRouter的图片响应格式：message.images数组
    if (message.images && Array.isArray(message.images) && message.images.length > 0) {
      console.log("[DEBUG] Found images array:", message.images.length)

      const firstImage = message.images[0]
      if (firstImage.image_url && firstImage.image_url.url) {
        const imageUrl = firstImage.image_url.url
        console.log("[DEBUG] Found image in OpenRouter format")
        return NextResponse.json({
          success: true,
          imageUrl: imageUrl,
          message: `基于提示词"${prompt}"生成的图片`,
          prompt: prompt,
          originalImagesCount: images.length
        })
      }
    }

    // 检查Google原生API格式：message.parts数组
    if (message.parts && Array.isArray(message.parts)) {
      console.log("[DEBUG] Found parts array:", message.parts.length)

      for (const part of message.parts) {
        // 检查inline_data字段（Google原生格式）
        if (part.inline_data && part.inline_data.data) {
          const base64Data = part.inline_data.data
          const mimeType = part.inline_data.mime_type || 'image/png'
          const imageUrl = `data:${mimeType};base64,${base64Data}`

          console.log("[DEBUG] Found image in parts.inline_data")
          return NextResponse.json({
            success: true,
            imageUrl: imageUrl,
            message: `基于提示词"${prompt}"生成的图片`,
            prompt: prompt,
            originalImagesCount: images.length
          })
        }

        // 检查inlineData字段（可能的变体格式）
        if (part.inlineData && part.inlineData.data) {
          const base64Data = part.inlineData.data
          const mimeType = part.inlineData.mimeType || 'image/png'
          const imageUrl = `data:${mimeType};base64,${base64Data}`

          console.log("[DEBUG] Found image in parts.inlineData")
          return NextResponse.json({
            success: true,
            imageUrl: imageUrl,
            message: `基于提示词"${prompt}"生成的图片`,
            prompt: prompt,
            originalImagesCount: images.length
          })
        }
      }
    }

    // 检查content字段（OpenAI格式）
    const content = message.content
    if (content) {
      console.log("[DEBUG] Response content:", content)
      console.log("[DEBUG] Content type:", typeof content)

      // 如果content是字符串，检查是否包含图片数据
      if (typeof content === 'string') {
        // 如果返回的是base64图片数据
        if (content.includes('data:image')) {
          const base64Match = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/)
          if (base64Match) {
            console.log("[DEBUG] Found base64 image in content")
            return NextResponse.json({
              success: true,
              imageUrl: base64Match[0],
              message: `基于提示词"${prompt}"生成的图片`,
              prompt: prompt,
              originalImagesCount: images.length
            })
          }
        }
      }
    }

    // 如果没有找到图片，检查是否返回了文本描述，如果是则重试
    if (content && typeof content === 'string' && content.length > 0) {
      console.log("[DEBUG] API返回了文本而不是图片，尝试重新生成...")

      // 提取用户的实际提示词（去除文件信息和之前的英文提示词）
      // 通常用户的中文提示词在最后一行
      const lines = prompt.split('\n')
      const userPrompt = lines[lines.length - 1] || prompt

      // 使用更强的英文提示词重试一次，只使用用户的实际提示词
      const retryPrompt = `GENERATE IMAGE ONLY - NO TEXT DESCRIPTION: ${userPrompt}

CRITICAL: Return actual image data, not text. I need a visual image file.`

      const retryMessageContent: any[] = [
        {
          type: "text",
          text: retryPrompt
        }
      ]

      // 添加图片到重试消息
      images.forEach((imageData: string) => {
        retryMessageContent.push({
          type: "image_url",
          image_url: {
            url: imageData
          }
        })
      })

      try {
        console.log("[DEBUG] 重试API调用...")

        const retryResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [
              {
                role: "user",
                content: retryMessageContent
              }
            ],
            modalities: ["image", "text"],
            max_tokens: 4000,
            temperature: 0.8, // 稍微提高温度
          }),
        })

        if (retryResponse.ok) {
          const retryData = await retryResponse.json()
          console.log("[DEBUG] 重试响应:", JSON.stringify(retryData, null, 2))

          // 重新检查重试响应中的图片
          const retryChoice = retryData.choices?.[0]
          const retryMessage = retryChoice?.message

          if (retryMessage?.images && Array.isArray(retryMessage.images) && retryMessage.images.length > 0) {
            const firstImage = retryMessage.images[0]
            if (firstImage.image_url && firstImage.image_url.url) {
              console.log("[DEBUG] 重试成功，找到图片")
              return NextResponse.json({
                success: true,
                imageUrl: firstImage.image_url.url,
                message: `基于提示词"${prompt}"生成的图片（重试成功）`,
                prompt: prompt,
                originalImagesCount: images.length
              })
            }
          }
        }
      } catch (retryError) {
        console.log("[DEBUG] 重试失败:", retryError)
      }
    }

    // 如果重试也失败，返回完整响应用于调试
    console.log("[DEBUG] No image found in response, full response:", data)
    return NextResponse.json({
      success: false,
      error: "未找到生成的图片",
      rawResponse: content,
      fullResponse: data,
      message: "API返回了响应但未包含图片数据。已尝试重试但仍未成功。这可能是因为：1) 地区限制 2) API格式变化 3) 模型当前不可用"
    })

  } catch (error) {
    console.error("[ERROR] Image generation error:", error)
    console.error("[ERROR] Error stack:", error instanceof Error ? error.stack : 'No stack trace')

    return NextResponse.json(
      { 
        error: "Failed to generate image", 
        details: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    )
  }
}
