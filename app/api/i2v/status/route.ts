import { NextRequest, NextResponse } from "next/server"

// 下载视频并上传到Supabase Storage
async function downloadAndStoreVideo(videoUrl: string, taskId: string): Promise<string | null> {
  try {
    console.log("[存储视频] 开始下载视频:", videoUrl.substring(0, 100) + "...")
    
    // 下载视频 - 使用更完整的headers
    const response = await fetch(videoUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Encoding": "identity",
      },
    })
    
    console.log("[存储视频] 下载响应状态:", response.status)
    
    if (!response.ok) {
      console.error("[存储视频] 下载失败:", response.status, response.statusText)
      return null
    }
    
    const videoBuffer = await response.arrayBuffer()
    console.log("[存储视频] 下载完成, 大小:", videoBuffer.byteLength, "bytes")
    
    if (videoBuffer.byteLength < 1000) {
      console.error("[存储视频] 视频文件太小，可能下载失败")
      return null
    }
    
    // 上传到Supabase Storage
    const { createServerClient } = await import("@/lib/supabase")
    const supabase = createServerClient()
    
    const fileName = `${taskId}.mp4`
    
    const { error } = await supabase.storage
      .from("video")
      .upload(fileName, videoBuffer, {
        contentType: "video/mp4",
        upsert: true
      })
    
    if (error) {
      console.error("[存储视频] 上传失败:", error)
      return null
    }
    
    // 获取公开URL
    const { data: urlData } = supabase.storage
      .from("video")
      .getPublicUrl(fileName)
    
    console.log("[存储视频] 上传成功, URL:", urlData.publicUrl)
    return urlData.publicUrl
    
  } catch (error) {
    console.error("[存储视频] 错误:", error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const taskId = searchParams.get("task_id")

    if (!taskId) {
      return NextResponse.json({
        success: false,
        error: "缺少task_id参数"
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

    console.log("[查询状态] 任务ID:", taskId)

    // 查询豆包API - 火山引擎视频生成任务查询接口
    const response = await fetch(`${apiUrl}/api/v3/contents/generations/tasks/${taskId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    })

    const responseText = await response.text()
    console.log("[查询状态] 响应状态:", response.status)
    console.log("[查询状态] 响应内容:", responseText)

    let data
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      console.error("[查询状态] 解析响应失败:", e)
      return NextResponse.json({
        success: false,
        error: "解析API响应失败",
        raw: responseText
      }, { status: 500 })
    }

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: "查询任务状态失败",
        details: data,
        status: response.status
      }, { status: response.status })
    }

    // 火山引擎/豆包 API 实际响应格式:
    // {
    //   "id": "cgt-xxx",
    //   "model": "seedance-1-lite",
    //   "status": "succeeded" | "running" | "failed" | "submitted",
    //   "content": { "video_url": "https://..." },  // 注意：content是对象不是数组
    //   "error": { "code": "xxx", "message": "xxx" }
    // }
    
    let status = "pending"
    let progress = 0
    let videoUrl = null
    let thumbnailUrl = null

    const rawStatus = (data.status || "").toLowerCase()
    console.log("[查询状态] 原始状态:", rawStatus)

    if (rawStatus === "succeeded" || rawStatus === "completed" || rawStatus === "success") {
      status = "completed"
      progress = 100
      
      // 实际格式: content.video_url (content是对象)
      if (data.content && typeof data.content === "object" && !Array.isArray(data.content)) {
        videoUrl = data.content.video_url
        thumbnailUrl = data.content.thumbnail_url || data.content.cover_url
        console.log("[查询状态] 从content对象提取video_url:", videoUrl)
      }
      
      // 备用: content是数组的情况
      if (!videoUrl && data.content && Array.isArray(data.content)) {
        for (const item of data.content) {
          if (item.type === "video_url" && item.video_url?.url) {
            videoUrl = item.video_url.url
            break
          }
          if (item.url) {
            videoUrl = item.url
            break
          }
          if (item.video_url && typeof item.video_url === "string") {
            videoUrl = item.video_url
            break
          }
        }
      }
      
      // 备用: output 格式
      if (!videoUrl && data.output && Array.isArray(data.output)) {
        videoUrl = data.output[0]?.url || data.output[0]?.video_url
        thumbnailUrl = data.output[0]?.thumbnail_url || data.output[0]?.cover_url
      }
      
      // 备用: 直接字段
      if (!videoUrl) {
        videoUrl = data.video_url || data.result?.video_url
        thumbnailUrl = data.thumbnail_url || data.cover_url || data.result?.thumbnail_url
      }
      
      console.log("[查询状态] 最终提取的视频URL:", videoUrl)
    } else if (rawStatus === "running" || rawStatus === "processing") {
      status = "processing"
      progress = 50
    } else if (rawStatus === "submitted" || rawStatus === "pending") {
      status = "processing"
      progress = 10
    } else if (rawStatus === "failed" || rawStatus === "error") {
      status = "failed"
      progress = 0
      console.log("[查询状态] 失败原因:", data.error)
    }

    // 如果视频生成完成，下载并存储到Supabase
    let storedVideoUrl = videoUrl
    if (status === "completed" && videoUrl) {
      console.log("[查询状态] 视频生成完成，开始存储到Supabase...")
      const permanentUrl = await downloadAndStoreVideo(videoUrl, taskId)
      if (permanentUrl) {
        storedVideoUrl = permanentUrl
        console.log("[查询状态] 视频已存储到Supabase:", permanentUrl)
      } else {
        console.warn("[查询状态] 视频存储失败，使用原始URL（可能24小时后过期）")
      }
    }

    // 更新数据库中的任务状态
    const { createServerClient } = await import("@/lib/supabase")
    const supabase = createServerClient()
    
    const updateData: any = {
      status: status,
      progress: progress,
    }
    
    if (storedVideoUrl) {
      updateData.video_url = storedVideoUrl
      console.log("[查询状态] 准备更新video_url:", storedVideoUrl)
    }
    if (thumbnailUrl) {
      updateData.thumbnail_url = thumbnailUrl
    }
    if (status === "failed" && data.error) {
      updateData.error_message = JSON.stringify(data.error)
    }
    
    console.log("[查询状态] 更新数据库:", updateData)
    
    const { error: dbError } = await supabase
      .from("video_generation_tasks")
      .update(updateData)
      .eq("task_id", taskId)
    
    if (dbError) {
      console.error("[查询状态] 数据库更新失败:", dbError)
    } else {
      console.log("[查询状态] 数据库更新成功")
    }

    return NextResponse.json({
      success: true,
      data: {
        task_id: taskId,
        status: status,
        progress: progress,
        video_url: storedVideoUrl,
        thumbnail_url: thumbnailUrl,
        raw_status: data.status,
        error: data.error,
        updated_at: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error("[查询状态] 错误:", error)
    return NextResponse.json({
      success: false,
      error: "查询状态失败",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
