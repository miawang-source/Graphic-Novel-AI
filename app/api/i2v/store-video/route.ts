import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const { taskId, videoUrl } = await request.json()

    if (!taskId || !videoUrl) {
      return NextResponse.json({ error: "缺少taskId或videoUrl参数" }, { status: 400 })
    }

    console.log("[手动存储] 开始下载视频:", videoUrl.substring(0, 100) + "...")

    // 下载视频 - 豆包的URL会触发下载而不是在线播放
    const response = await fetch(videoUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Encoding": "identity",
      },
      redirect: "follow",
    })

    console.log("[手动存储] 下载响应状态:", response.status, response.statusText)
    console.log("[手动存储] Content-Type:", response.headers.get("content-type"))
    console.log("[手动存储] Content-Length:", response.headers.get("content-length"))

    if (!response.ok) {
      const errorText = await response.text().catch(() => "无法读取错误内容")
      console.error("[手动存储] 下载失败:", errorText)
      return NextResponse.json(
        { error: "下载视频失败", status: response.status, details: errorText },
        { status: 500 }
      )
    }

    const videoBuffer = await response.arrayBuffer()
    console.log("[手动存储] 下载完成, 大小:", videoBuffer.byteLength, "bytes")

    // 上传到Supabase Storage
    const supabase = createServerClient()
    const fileName = `${taskId}.mp4`

    const { error: uploadError } = await supabase.storage
      .from("video")
      .upload(fileName, videoBuffer, {
        contentType: "video/mp4",
        upsert: true,
      })

    if (uploadError) {
      console.error("[手动存储] 上传失败:", uploadError)
      return NextResponse.json({ error: "上传失败", details: uploadError }, { status: 500 })
    }

    // 获取公开URL
    const { data: urlData } = supabase.storage.from("video").getPublicUrl(fileName)

    const permanentUrl = urlData.publicUrl
    console.log("[手动存储] 上传成功, URL:", permanentUrl)

    // 更新数据库
    const { error: dbError } = await supabase
      .from("video_generation_tasks")
      .update({ video_url: permanentUrl })
      .eq("task_id", taskId)

    if (dbError) {
      console.error("[手动存储] 数据库更新失败:", dbError)
      return NextResponse.json({ error: "数据库更新失败", details: dbError }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "视频已存储到Supabase",
      permanentUrl,
    })
  } catch (error) {
    console.error("[手动存储] 错误:", error)
    return NextResponse.json(
      { error: "存储失败", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
