import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const videoUrl = searchParams.get("url")
    const isDownload = searchParams.get("download") === "1"

    if (!videoUrl) {
      return NextResponse.json({ error: "缺少url参数" }, { status: 400 })
    }

    console.log("[视频代理] 请求URL:", videoUrl.substring(0, 100) + "...")

    // 获取Range头，支持视频seek
    const range = request.headers.get("range")

    const headers: HeadersInit = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }

    if (range) {
      headers["Range"] = range
    }

    const response = await fetch(videoUrl, { headers })

    if (!response.ok && response.status !== 206) {
      console.error("[视频代理] 获取视频失败:", response.status)
      return NextResponse.json(
        { error: "获取视频失败", status: response.status },
        { status: response.status }
      )
    }

    const videoBuffer = await response.arrayBuffer()

    // 构建响应头
    const responseHeaders: HeadersInit = {
      "Content-Type": response.headers.get("Content-Type") || "video/mp4",
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
    }

    // 如果是下载请求，添加下载头
    if (isDownload) {
      responseHeaders["Content-Disposition"] = "attachment; filename=video.mp4"
    }

    const contentLength = response.headers.get("Content-Length")
    if (contentLength) {
      responseHeaders["Content-Length"] = contentLength
    }

    const contentRange = response.headers.get("Content-Range")
    if (contentRange) {
      responseHeaders["Content-Range"] = contentRange
    }

    return new NextResponse(videoBuffer, {
      status: response.status,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error("[视频代理] 错误:", error)
    return NextResponse.json(
      { error: "代理视频失败", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
