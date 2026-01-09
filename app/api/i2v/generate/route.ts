import { NextRequest, NextResponse } from "next/server"

// 将图片URL转换为base64
async function imageUrlToBase64(imageUrl: string): Promise<string> {
  // 如果已经是base64格式，直接返回
  if (imageUrl.startsWith("data:")) {
    return imageUrl
  }

  try {
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString("base64")
    
    // 获取content-type
    const contentType = response.headers.get("content-type") || "image/png"
    
    return `data:${contentType};base64,${base64}`
  } catch (error) {
    console.error("[图片转换] 转换失败:", error)
    throw new Error(`图片转换失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      platform = "doubao",
      mode = "single",
      sourceImageUrl,
      endFrameImageUrl,
      referenceImages = [],
      prompt,
      negativePrompt,
      duration = 5,
      resolution = "720p",
      motionIntensity = "medium",
      batchSize = 1,
      cameraFixed = false,
      aspectRatio = "16:9",
      seed,
    } = body

    console.log("[图生视频] 收到请求:", {
      platform,
      mode,
      hasSourceImage: !!sourceImageUrl,
      hasEndFrame: !!endFrameImageUrl,
      referenceImagesCount: referenceImages.length,
      prompt,
      duration,
      motionIntensity,
      batchSize,
    })

    // 验证必需参数
    if (!sourceImageUrl && mode !== "multi") {
      return NextResponse.json({
        success: false,
        error: "缺少源图片URL"
      }, { status: 400 })
    }

    if (!prompt) {
      return NextResponse.json({
        success: false,
        error: "缺少提示词"
      }, { status: 400 })
    }

    if (mode === "dual" && !endFrameImageUrl) {
      return NextResponse.json({
        success: false,
        error: "首尾帧模式需要提供尾帧图片"
      }, { status: 400 })
    }

    if (mode === "multi" && referenceImages.length < 2) {
      return NextResponse.json({
        success: false,
        error: "多图参考模式需要至少2张图片"
      }, { status: 400 })
    }

    // 获取API配置
    const apiKey = process.env.DOUBAO_API_KEY
    const apiUrl = process.env.DOUBAO_API_URL

    if (!apiKey || !apiUrl) {
      return NextResponse.json({
        success: false,
        error: "豆包API未配置"
      }, { status: 500 })
    }

    // 构建提示词 - 根据豆包官方文档，参数通过 --[parameter] 格式添加到提示词中
    let fullPrompt = prompt
    
    // 添加模型文本命令参数
    const params: string[] = []
    
    // 分辨率 (resolution/rs)
    // Seedance 1.5 pro、1.0 lite 默认720p，1.0 pro 默认1080p
    params.push(`--rs ${resolution}`)
    
    // 宽高比 (ratio/rt)
    const ratioMap: Record<string, string> = {
      "16:9": "16:9",
      "9:16": "9:16",
      "1:1": "1:1",
      "4:3": "4:3",
      "3:4": "3:4",
      "21:9": "21:9"
    }
    params.push(`--rt ${ratioMap[aspectRatio] || "16:9"}`)
    
    // 时长 (duration/dur) - 支持 2-12 秒
    params.push(`--dur ${duration}`)
    
    // 帧率 (framespersecond/fps) - 固定24
    params.push(`--fps 24`)
    
    // 种子 (seed) - -1表示随机
    params.push(`--seed ${seed !== null && seed !== undefined ? seed : -1}`)
    
    // 镜头固定 (camerafixed/cf)
    params.push(`--cf ${cameraFixed}`)
    
    // 水印 (watermark/wm) - 默认不含水印
    params.push(`--wm false`)
    
    // 将参数添加到提示词末尾
    fullPrompt = `${prompt} ${params.join(" ")}`
    
    console.log("[图生视频] 完整提示词:", fullPrompt)
    
    // 添加负向提示词（如果支持）
    // 注意：豆包API可能不直接支持负向提示词，这里仅作为参考
    if (negativePrompt) {
      console.log("[图生视频] 负向提示词:", negativePrompt)
      // fullPrompt += `\n负向提示词: ${negativePrompt}`
    }

    // 将所有图片URL转换为base64（因为内网URL豆包API无法访问）
    console.log("[图生视频] 转换图片为base64...")
    
    let sourceImageBase64 = ""
    let endFrameImageBase64 = ""
    let referenceImagesBase64: string[] = []

    try {
      if (sourceImageUrl) {
        sourceImageBase64 = await imageUrlToBase64(sourceImageUrl)
        console.log("[图生视频] 源图片转换完成")
      }
      
      if (mode === "dual" && endFrameImageUrl) {
        endFrameImageBase64 = await imageUrlToBase64(endFrameImageUrl)
        console.log("[图生视频] 尾帧图片转换完成")
      }
      
      if (mode === "multi" && referenceImages.length > 0) {
        referenceImagesBase64 = await Promise.all(
          referenceImages.map((url: string) => imageUrlToBase64(url))
        )
        console.log("[图生视频] 参考图片转换完成:", referenceImagesBase64.length, "张")
      }
    } catch (error) {
      console.error("[图生视频] 图片转换失败:", error)
      return NextResponse.json({
        success: false,
        error: "图片处理失败",
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500 })
    }

    // 构建请求内容
    const content: any[] = [
      {
        type: "text",
        text: fullPrompt
      }
    ]

    // 根据模式添加图片
    if (mode === "dual" && endFrameImageBase64) {
      // 首尾帧模式 - 需要传入2个image_url对象，role必填
      content.push({
        type: "image_url",
        image_url: { url: sourceImageBase64 },
        role: "first_frame"
      })
      content.push({
        type: "image_url",
        image_url: { url: endFrameImageBase64 },
        role: "last_frame"
      })
    } else if (mode === "multi") {
      // 多图参考模式 - Seedance 1.0 lite i2v 支持1-4张参考图
      // 每张参考图片的role均为：reference_image
      referenceImagesBase64.forEach((imageBase64: string) => {
        content.push({
          type: "image_url",
          image_url: { url: imageBase64 },
          role: "reference_image"
        })
      })
    } else {
      // 单图模式 - 首帧图生视频，role可不填或为first_frame
      content.push({
        type: "image_url",
        image_url: { url: sourceImageBase64 },
        role: "first_frame"
      })
    }

    console.log("[图生视频] 调用豆包API...")
    console.log("- 模型: doubao-seedance-1-0-lite-i2v-250428")
    console.log("- 模式:", mode)
    console.log("- 批量数量:", batchSize)
    console.log("- 完整提示词:", fullPrompt)
    console.log("- 内容数组长度:", content.length)

    // 构建请求体 - 根据豆包官方文档
    const requestBody: any = {
      model: "doubao-seedance-1-0-lite-i2v-250428",
      content: content,
    }

    // 根据batchSize发送多个请求
    const taskIds: string[] = []
    const actualBatchSize = Math.min(Math.max(1, batchSize), 4) // 限制1-4个
    
    const { createServerClient } = await import("@/lib/supabase")
    const supabase = createServerClient()

    for (let i = 0; i < actualBatchSize; i++) {
      console.log(`[图生视频] 发送第 ${i + 1}/${actualBatchSize} 个请求...`)
      
      // 调用豆包API
      const response = await fetch(`${apiUrl}/api/v3/contents/generations/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      })

      const responseText = await response.text()
      console.log(`[图生视频] 第 ${i + 1} 个请求响应状态:`, response.status)

      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        console.error(`[图生视频] 第 ${i + 1} 个请求解析响应失败:`, e)
        continue // 跳过这个，继续下一个
      }

      if (!response.ok) {
        console.error(`[图生视频] 第 ${i + 1} 个请求失败:`, data)
        continue // 跳过这个，继续下一个
      }

      taskIds.push(data.id)

      // 保存任务到数据库
      const { error: dbError } = await supabase
        .from("video_generation_tasks")
        .insert({
          task_id: data.id,
          status: "pending",
          progress: 0,
          model: platform,
          mode: mode,
          prompt: prompt,
          negative_prompt: negativePrompt || null,
          duration: duration,
          resolution: resolution,
          aspect_ratio: aspectRatio,
          fps: 24,
          camera_fixed: cameraFixed,
          seed: seed || -1,
          source_image_url: sourceImageUrl ? sourceImageUrl.substring(0, 500) : null,
          end_frame_image_url: endFrameImageUrl ? endFrameImageUrl.substring(0, 500) : null,
          reference_images: mode === "multi" ? referenceImages.map((url: string) => url.substring(0, 500)) : [],
        })

      if (dbError) {
        console.error(`[图生视频] 第 ${i + 1} 个任务保存数据库失败:`, dbError)
      } else {
        console.log(`[图生视频] 第 ${i + 1} 个任务已保存到数据库`)
      }
    }

    if (taskIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: "所有请求都失败了"
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        task_ids: taskIds,
        task_id: taskIds[0], // 兼容单个任务的情况
        count: taskIds.length,
        status: "pending",
        duration: duration,
        mode: mode,
      }
    })

  } catch (error) {
    console.error("[图生视频] 错误:", error)
    return NextResponse.json({
      success: false,
      error: "生成视频失败",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
