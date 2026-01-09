import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get("limit") || "20")
    const offset = parseInt(searchParams.get("offset") || "0")

    const supabase = createServerClient()

    const { data: tasks, error } = await supabase
      .from("video_generation_tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("[历史记录] 查询失败:", error)
      return NextResponse.json({
        success: false,
        error: "查询历史记录失败",
        details: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: tasks || []
    })

  } catch (error) {
    console.error("[历史记录] 错误:", error)
    return NextResponse.json({
      success: false,
      error: "获取历史记录失败",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
