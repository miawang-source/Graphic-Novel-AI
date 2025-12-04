import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const { batchId } = params

    if (!batchId) {
      return NextResponse.json({ error: "No batch ID provided" }, { status: 400 })
    }

    const supabase = createServerClient()

    // 获取该批次的所有队列项
    const { data: queueItems, error: fetchError } = await supabase
      .from("material_upload_queue")
      .select("*")
      .eq("batch_id", batchId)
      .order("created_at", { ascending: true })

    if (fetchError) {
      throw new Error(`获取队列状态失败: ${fetchError.message}`)
    }

    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json({ 
        error: "Batch not found",
        message: "未找到该批次"
      }, { status: 404 })
    }

    // 统计各状态的数量
    const stats = {
      total: queueItems.length,
      pending: queueItems.filter(item => item.status === 'pending').length,
      analyzing: queueItems.filter(item => item.status === 'analyzing').length,
      uploading: queueItems.filter(item => item.status === 'uploading').length,
      completed: queueItems.filter(item => item.status === 'completed').length,
      failed: queueItems.filter(item => item.status === 'failed').length,
    }

    // 计算总体进度
    const totalProgress = queueItems.reduce((sum, item) => sum + (item.progress || 0), 0)
    const averageProgress = Math.round(totalProgress / queueItems.length)

    // 判断批次是否完成
    const isCompleted = stats.pending === 0 && stats.analyzing === 0 && stats.uploading === 0
    const hasErrors = stats.failed > 0

    // 返回详细信息
    const items = queueItems.map(item => ({
      id: item.id,
      fileName: item.file_name,
      fileSize: item.file_size,
      fileType: item.file_type,
      status: item.status,
      progress: item.progress,
      errorMessage: item.error_message,
      materialId: item.material_id,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }))

    return NextResponse.json({
      success: true,
      batchId,
      stats,
      averageProgress,
      isCompleted,
      hasErrors,
      items,
    })

  } catch (error) {
    console.error("[STATUS] Batch status query error:", error)
    return NextResponse.json(
      {
        error: "查询批次状态失败",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
