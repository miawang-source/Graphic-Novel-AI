import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    console.log("[BATCH] Batch upload API called")

    const formData = await request.formData()
    const files = formData.getAll("files") as File[]
    const category = formData.get("category") as string

    console.log("[BATCH] Received files:", files.length, "Category:", category)

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    if (!category) {
      return NextResponse.json({ error: "No category provided" }, { status: 400 })
    }

    // 验证分类
    const validCategories = [
      'ancient-male', 'ancient-female', 'modern-male', 'modern-female', 'fantasy',
      'ancient-residence', 'ancient-location', 'modern-residence', 'modern-location', 'nature'
    ]

    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 })
    }

    // 确定主分类
    const characterCategories = ['ancient-male', 'ancient-female', 'modern-male', 'modern-female', 'fantasy']
    const categoryType = characterCategories.includes(category) ? 'character' : 'scene'

    const supabase = createServerClient()

    // 生成批次ID
    const batchId = crypto.randomUUID()

    console.log("[BATCH] Generated batch ID:", batchId)

    // 验证所有文件
    const validatedFiles: Array<{
      file: File
      fileName: string
      fileSize: number
      fileType: string
    }> = []

    for (const file of files) {
      const fileExtension = file.name.split('.').pop()?.toLowerCase()
      const isPsd = fileExtension === 'psd'
      const isPdf = fileExtension === 'pdf'

      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
      const psdMimeTypes = [
        "application/photoshop",
        "application/x-photoshop",
        "image/vnd.adobe.photoshop",
        "image/photoshop"
      ]
      const pdfMimeTypes = ["application/pdf"]

      if (!allowedTypes.includes(file.type) && !isPsd && !isPdf && 
          !psdMimeTypes.includes(file.type) && !pdfMimeTypes.includes(file.type)) {
        console.log("[BATCH] Skipping invalid file:", file.name, "Type:", file.type)
        continue
      }

      // 文件大小验证
      const maxSize = (isPsd || isPdf) ? 500 * 1024 * 1024 : 10 * 1024 * 1024
      if (file.size > maxSize) {
        console.log("[BATCH] Skipping oversized file:", file.name, "Size:", file.size)
        continue
      }

      validatedFiles.push({
        file,
        fileName: file.name,
        fileSize: file.size,
        fileType: fileExtension || 'unknown'
      })
    }

    if (validatedFiles.length === 0) {
      return NextResponse.json({ error: "No valid files to upload" }, { status: 400 })
    }

    console.log("[BATCH] Validated files:", validatedFiles.length)

    // 将文件信息插入队列表
    const queueRecords = validatedFiles.map(({ fileName, fileSize, fileType }) => ({
      batch_id: batchId,
      file_name: fileName,
      file_size: fileSize,
      file_type: fileType,
      category_type: categoryType,
      subcategory: category,
      status: 'pending',
      progress: 0
    }))

    const { data: insertedRecords, error: insertError } = await supabase
      .from("material_upload_queue")
      .insert(queueRecords)
      .select()

    if (insertError) {
      console.error("[BATCH] Queue insert error:", insertError)
      throw new Error(`Failed to create upload queue: ${insertError.message}`)
    }

    console.log("[BATCH] Inserted", insertedRecords.length, "records into queue")

    // 将文件临时存储到Supabase Storage的临时目录
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    const { createClient } = await import("@supabase/supabase-js")
    const storageClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    })

    // 上传文件到临时目录
    const uploadPromises = validatedFiles.map(async ({ file, fileName }, index) => {
      const tempFileName = `temp/${batchId}/${fileName}`
      
      try {
        const { error: uploadError } = await storageClient.storage
          .from("material")
          .upload(tempFileName, file, {
            contentType: file.type,
            upsert: false,
          })

        if (uploadError) {
          console.error("[BATCH] Temp upload error for", fileName, ":", uploadError)
          // 更新队列记录为失败
          await supabase
            .from("material_upload_queue")
            .update({
              status: 'failed',
              error_message: `临时上传失败: ${uploadError.message}`
            })
            .eq('id', insertedRecords[index].id)
          
          return { success: false, fileName }
        }

        console.log("[BATCH] Temp uploaded:", tempFileName)
        return { success: true, fileName }
      } catch (error) {
        console.error("[BATCH] Temp upload exception for", fileName, ":", error)
        return { success: false, fileName }
      }
    })

    const uploadResults = await Promise.all(uploadPromises)
    const successCount = uploadResults.filter(r => r.success).length

    console.log("[BATCH] Temp upload completed:", successCount, "/", validatedFiles.length)

    return NextResponse.json({
      success: true,
      batchId,
      totalFiles: validatedFiles.length,
      queuedFiles: insertedRecords.length,
      uploadedToTemp: successCount,
      message: `已将 ${successCount} 个文件加入上传队列`
    })

  } catch (error) {
    console.error("[BATCH] Batch upload error:", error)
    return NextResponse.json(
      {
        error: "批量上传失败",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
