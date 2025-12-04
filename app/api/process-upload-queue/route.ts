import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { createClient } from "@supabase/supabase-js"
import { readPsd, initializeCanvas } from 'ag-psd'
import sharp from 'sharp'

// 初始化虚拟Canvas（复用analyze-material的逻辑）
const createCanvas = (width: number, height: number) => {
  const context = {
    createImageData: (w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4)
    }),
    putImageData: () => {},
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4)
    }),
    drawImage: () => {},
    fillRect: () => {},
    clearRect: () => {}
  }

  return {
    width,
    height,
    getContext: (type: string) => type === '2d' ? context : null,
    toBuffer: () => Buffer.alloc(0),
    toDataURL: () => ''
  }
}

const createCanvasFromData = (data: Uint8Array) => {
  const context = {
    createImageData: (w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4)
    }),
    putImageData: () => {},
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4)
    }),
    drawImage: () => {},
    fillRect: () => {},
    clearRect: () => {}
  }

  return {
    width: 1,
    height: 1,
    getContext: (type: string) => type === '2d' ? context : null,
    toBuffer: () => Buffer.from(data),
    toDataURL: () => ''
  }
}

try {
  initializeCanvas(createCanvas as any, createCanvasFromData as any)
} catch (initError) {
  console.log("[QUEUE] Canvas initialization skipped:", initError)
}

// 处理单个文件的函数
async function processQueueItem(queueItem: any, supabase: any, storageClient: any) {
  const { id, batch_id, file_name, file_type, category_type, subcategory } = queueItem

  try {
    console.log("[QUEUE] Processing:", file_name)

    // 更新状态为analyzing
    await supabase
      .from("material_upload_queue")
      .update({ status: 'analyzing', progress: 10, updated_at: new Date().toISOString() })
      .eq('id', id)

    // 从临时存储获取文件
    const tempFilePath = `temp/${batch_id}/${file_name}`
    const { data: fileData, error: downloadError } = await storageClient.storage
      .from("material")
      .download(tempFilePath)

    if (downloadError) {
      throw new Error(`下载临时文件失败: ${downloadError.message}`)
    }

    // 转换为ArrayBuffer
    const arrayBuffer = await fileData.arrayBuffer()

    // 处理文件（PSD/PDF/普通图片）
    let imageForAnalysis: { bytes: ArrayBuffer; mimeType: string; fileName: string }
    let originalFile: ArrayBuffer | null = null
    const isPsd = file_type === 'psd'
    const isPdf = file_type === 'pdf'

    if (isPsd) {
      console.log("[QUEUE] Processing PSD file...")
      originalFile = arrayBuffer

      const psdData = readPsd(arrayBuffer, {
        useImageData: true,
        useRawThumbnail: true,
        skipLayerImageData: true
      })

      if (!psdData) {
        throw new Error('无法解析PSD文件')
      }

      let thumbnailBytes: ArrayBuffer | undefined
      let thumbnailMimeType: string | undefined

      // 提取缩略图（使用与analyze-material相同的逻辑）
      if ((psdData as any).thumbnailRaw) {
        const rawData = (psdData as any).thumbnailRaw
        if (rawData instanceof ArrayBuffer) {
          thumbnailBytes = rawData
        } else if (rawData.buffer) {
          thumbnailBytes = rawData.buffer.slice(rawData.byteOffset, rawData.byteOffset + rawData.byteLength)
        } else {
          const uint8Array = new Uint8Array(rawData)
          thumbnailBytes = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength)
        }
        thumbnailMimeType = 'image/jpeg'
      }

      if (!thumbnailBytes && (psdData as any).thumbnail) {
        if ((psdData as any).thumbnail.data) {
          const thumbData = (psdData as any).thumbnail.data
          if (thumbData instanceof ArrayBuffer) {
            thumbnailBytes = thumbData
          } else if (thumbData.buffer) {
            thumbnailBytes = thumbData.buffer.slice(thumbData.byteOffset, thumbData.byteOffset + thumbData.byteLength)
          } else {
            const uint8Array = new Uint8Array(thumbData)
            thumbnailBytes = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength)
          }
          thumbnailMimeType = 'image/jpeg'
        }
      }

      if (!thumbnailBytes && psdData.imageData) {
        const imageData = psdData.imageData
        const width = psdData.width
        const height = psdData.height

        if (imageData.data && imageData.data.length > 0) {
          const pngBuffer = await sharp(Buffer.from(imageData.data), {
            raw: {
              width: width,
              height: height,
              channels: 4
            }
          })
          .png()
          .toBuffer()

          thumbnailBytes = new Uint8Array(pngBuffer).buffer
          thumbnailMimeType = 'image/png'
        }
      }

      if (!thumbnailBytes || !thumbnailMimeType) {
        throw new Error('无法从PSD文件提取图像数据')
      }

      imageForAnalysis = {
        bytes: thumbnailBytes,
        mimeType: thumbnailMimeType,
        fileName: file_name.replace('.psd', thumbnailMimeType === 'image/jpeg' ? '.jpg' : '.png')
      }
    } else if (isPdf) {
      console.log("[QUEUE] Processing PDF file...")
      originalFile = arrayBuffer

      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
      
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        useSystemFonts: true,
      })
      const pdfDocument = await loadingTask.promise
      const page = await pdfDocument.getPage(1)
      const viewport = page.getViewport({ scale: 2.0 })
      
      const Canvas = (await import('canvas')).default
      const canvas = Canvas.createCanvas(viewport.width, viewport.height)
      const context = canvas.getContext('2d')
      
      await page.render({
        canvasContext: context as any,
        viewport: viewport,
        canvas: canvas as any,
      }).promise
      
      const pngBuffer = canvas.toBuffer('image/png')
      const pngArrayBuffer = pngBuffer.buffer.slice(pngBuffer.byteOffset, pngBuffer.byteOffset + pngBuffer.byteLength) as ArrayBuffer
      
      imageForAnalysis = {
        bytes: pngArrayBuffer,
        mimeType: 'image/png',
        fileName: file_name.replace('.pdf', '.png')
      }
    } else {
      // 普通图片
      imageForAnalysis = {
        bytes: arrayBuffer,
        mimeType: fileData.type || 'image/jpeg',
        fileName: file_name
      }
    }

    // 更新进度
    await supabase
      .from("material_upload_queue")
      .update({ progress: 30, updated_at: new Date().toISOString() })
      .eq('id', id)

    // 跳过AI分析，使用空值
    console.log("[QUEUE] Skipping AI analysis for batch upload...")
    const analysisResult = {
      tags: [],
      chinese_prompt: "",
      english_prompt: ""
    }

    /* AI分析已禁用 - 批量上传不需要AI分析
    console.log("[QUEUE] Starting AI analysis...")
    const base64 = Buffer.from(imageForAnalysis.bytes).toString("base64")
    const mimeType = imageForAnalysis.mimeType

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-2024-07-18",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `你是一个专业的图片内容分析师，专门为动漫插画素材生成标签和绘画提示词。

分析要求：
1. 仔细观察图片中的人物外貌、服装、姿势、表情
2. 识别背景环境、色彩风格、画风特点
3. 生成3-8个精准的描述性标签，便于检索匹配
4. 创建详细的中文绘画描述
5. 生成符合AI绘图工具要求的英文prompt

标签要求：
- 包含人物特征（如：黑发男子、古装女子、持剑少年）
- 包含服装风格（如：古装、现代装、校服、军装）
- 包含场景元素（如：竹林、城市、古建筑）
- 包含风格特征（如：水墨风、日系动漫、写实风格）

请以JSON格式返回结果：
{
  "tags": ["标签1", "标签2", "标签3"],
  "chinese_prompt": "详细的中文绘画描述",
  "english_prompt": "detailed English prompt for AI image generation"
}`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`AI分析失败: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error("AI分析返回内容为空")
    }

    let analysisResult
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0])
      } else {
        analysisResult = JSON.parse(content)
      }
    } catch (parseError) {
      analysisResult = {
        tags: ["动漫风格", "插画素材"],
        chinese_prompt: "动漫风格的插画素材",
        english_prompt: "anime style illustration material",
      }
    }

    console.log("[QUEUE] AI analysis completed")
    */

    // 更新进度和分析结果
    await supabase
      .from("material_upload_queue")
      .update({ 
        status: 'uploading',
        progress: 60,
        analysis_result: analysisResult,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    // 上传原始文件（如果是PSD/PDF）
    let originalFileUrl: string | null = null

    if (isPsd && originalFile) {
      const originalFileName = `originals/${Date.now()}-${Math.random().toString(36).substring(2)}.psd`
      const { error: originalUploadError } = await storageClient.storage
        .from("material")
        .upload(originalFileName, new Blob([originalFile]), {
          contentType: "application/octet-stream",
          upsert: false,
        })

      if (!originalUploadError) {
        const { data: originalUrlData } = storageClient.storage.from("material").getPublicUrl(originalFileName)
        originalFileUrl = originalUrlData.publicUrl
      }
    } else if (isPdf && originalFile) {
      const originalFileName = `originals/${Date.now()}-${Math.random().toString(36).substring(2)}.pdf`
      const { error: originalUploadError } = await storageClient.storage
        .from("material")
        .upload(originalFileName, new Blob([originalFile]), {
          contentType: "application/pdf",
          upsert: false,
        })

      if (!originalUploadError) {
        const { data: originalUrlData } = storageClient.storage.from("material").getPublicUrl(originalFileName)
        originalFileUrl = originalUrlData.publicUrl
      }
    }

    // 上传缩略图/图片
    const extFromMime = (mime: string) => mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : file_type
    const thumbnailExtension = extFromMime(imageForAnalysis.mimeType)
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${thumbnailExtension}`

    const thumbnailBlob = new Blob([imageForAnalysis.bytes], { type: imageForAnalysis.mimeType })
    const { data: uploadData, error: uploadError } = await storageClient.storage
      .from("material")
      .upload(uniqueFileName, thumbnailBlob, {
        contentType: imageForAnalysis.mimeType,
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`上传文件失败: ${uploadError.message}`)
    }

    const { data: urlData } = storageClient.storage.from("material").getPublicUrl(uniqueFileName)

    // 更新进度
    await supabase
      .from("material_upload_queue")
      .update({ progress: 80, updated_at: new Date().toISOString() })
      .eq('id', id)

    // 保存到materials表
    const { data: materialData, error: dbError } = await supabase
      .from("materials")
      .insert({
        title: file_name.replace(/\.[^/.]+$/, ""),
        image_url: urlData.publicUrl,
        file_type: file_type,
        original_filename: file_name,
        category_type: category_type,
        subcategory: subcategory,
        tags: analysisResult.tags,
        chinese_prompt: analysisResult.chinese_prompt,
        english_prompt: analysisResult.english_prompt,
        // 注意：original_file_url 字段不存在于materials表，原始文件已上传到Storage但不记录URL
      })
      .select()
      .single()

    if (dbError) {
      throw new Error(`保存到数据库失败: ${dbError.message}`)
    }

    console.log("[QUEUE] Material saved to database:", materialData.id)

    // 删除临时文件
    await storageClient.storage.from("material").remove([tempFilePath])

    // 更新队列状态为completed
    await supabase
      .from("material_upload_queue")
      .update({ 
        status: 'completed',
        progress: 100,
        material_id: materialData.id,
        storage_path: uniqueFileName,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    console.log("[QUEUE] Processing completed for:", file_name)
    return { success: true, fileName: file_name }

  } catch (error) {
    console.error("[QUEUE] Processing error for", file_name, ":", error)

    // 更新队列状态为failed
    await supabase
      .from("material_upload_queue")
      .update({ 
        status: 'failed',
        error_message: error instanceof Error ? error.message : "Unknown error",
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    return { success: false, fileName: file_name, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { batchId } = await request.json()

    if (!batchId) {
      return NextResponse.json({ error: "No batch ID provided" }, { status: 400 })
    }

    console.log("[QUEUE] Processing batch:", batchId)

    const supabase = createServerClient()

    // 获取待处理的队列项
    const { data: queueItems, error: fetchError } = await supabase
      .from("material_upload_queue")
      .select("*")
      .eq("batch_id", batchId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })

    if (fetchError) {
      throw new Error(`获取队列失败: ${fetchError.message}`)
    }

    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json({ 
        success: true,
        message: "没有待处理的文件",
        processed: 0
      })
    }

    console.log("[QUEUE] Found", queueItems.length, "items to process")

    // 创建storage客户端
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    const storageClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    })

    // 逐个处理（避免并发过多导致API限流）
    const results = []
    for (const item of queueItems) {
      const result = await processQueueItem(item, supabase, storageClient)
      results.push(result)
      
      // 每个文件之间稍微延迟，避免API限流
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    const successCount = results.filter(r => r.success).length
    const failedCount = results.filter(r => !r.success).length

    console.log("[QUEUE] Batch processing completed. Success:", successCount, "Failed:", failedCount)

    return NextResponse.json({
      success: true,
      batchId,
      processed: results.length,
      succeeded: successCount,
      failed: failedCount,
      results
    })

  } catch (error) {
    console.error("[QUEUE] Queue processing error:", error)
    return NextResponse.json(
      {
        error: "队列处理失败",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
