import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { createClient } from "@supabase/supabase-js"
import { readPsd, initializeCanvas } from 'ag-psd'
import sharp from 'sharp'

// 初始化虚拟Canvas以避免Canvas依赖错误
const createCanvas = (width: number, height: number) => {
  // 创建虚拟的2D context
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

  // 返回一个虚拟Canvas对象
  return {
    width,
    height,
    getContext: (type: string) => type === '2d' ? context : null,
    toBuffer: () => Buffer.alloc(0),
    toDataURL: () => ''
  }
}

const createCanvasFromData = (data: Uint8Array) => {
  // 创建虚拟的2D context
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

  // 返回一个虚拟Canvas对象
  return {
    width: 1,
    height: 1,
    getContext: (type: string) => type === '2d' ? context : null,
    toBuffer: () => Buffer.from(data),
    toDataURL: () => ''
  }
}

// 初始化ag-psd的Canvas方法
try {
  initializeCanvas(createCanvas as any, createCanvasFromData as any)
  console.log("[DEBUG] Virtual Canvas initialized for ag-psd")
} catch (initError) {
  console.log("[DEBUG] Canvas initialization skipped:", initError)
}

export async function POST(request: NextRequest) {
  try {
    console.log("[DEBUG] analyze-material API called")

    const formData = await request.formData()
    const file = formData.get("file") as File
    const category = formData.get("category") as string
    const userTags = formData.get("tags") as string
    const userChinesePrompt = formData.get("chinese_prompt") as string
    const userEnglishPrompt = formData.get("english_prompt") as string

    console.log("[DEBUG] File:", file?.name, "Category:", category)
    console.log("[DEBUG] User provided data:", { userTags, userChinesePrompt, userEnglishPrompt })

    // 如果category是"temp"，则只进行AI分析，不保存到数据库
    const isAnalysisOnly = category === "temp"

    if (!file) {
      console.error("[DEBUG] No file provided")
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!category) {
      console.error("[DEBUG] No category provided")
      return NextResponse.json({ error: "No category provided" }, { status: 400 })
    }

    // 检查文件类型
    const fileExtension = file.name.split(".").pop()?.toLowerCase()
    const isPsd = fileExtension === 'psd'
    const isPdf = fileExtension === 'pdf'

    console.log("[DEBUG] File extension:", fileExtension, "isPSD:", isPsd, "isPDF:", isPdf)

    // 处理PSD/PDF文件或普通图片文件
    let imageForAnalysis: { bytes: ArrayBuffer; mimeType: string; fileName: string }
    let originalPsdFile: File | null = null
    let originalPdfFile: File | null = null
    let psdWidth = 0
    let psdHeight = 0

    if (isPsd) {
      console.log("[DEBUG] Processing PSD file...")

      // 保存原始PSD文件引用
      originalPsdFile = file

      let psdData: any
      try {
        // 读取PSD文件
        console.log("[DEBUG] Reading PSD file bytes...")
        const psdBytes = await file.arrayBuffer()
        console.log("[DEBUG] PSD file size:", psdBytes.byteLength, "bytes")

        // 解析PSD文件，使用原始数据选项避免Canvas依赖
        console.log("[DEBUG] Parsing PSD with ag-psd...")
        psdData = readPsd(psdBytes, {
          useImageData: true,      // 使用原始图像数据而不是Canvas
          useRawThumbnail: true,   // 使用原始缩略图数据
          skipLayerImageData: true // 跳过图层数据以提高性能
        })

        if (!psdData) {
          throw new Error('无法解析PSD文件')
        }

        psdWidth = psdData.width
        psdHeight = psdData.height

        console.log("[DEBUG] PSD parsed successfully. Size:", psdWidth, "x", psdHeight)
        console.log("[DEBUG] PSD has imageData:", !!psdData.imageData)
        console.log("[DEBUG] PSD has thumbnail:", !!psdData.thumbnail)
        console.log("[DEBUG] PSD has thumbnailRaw:", !!psdData.thumbnailRaw)
      } catch (psdError) {
        console.error("[ERROR] PSD parsing failed:", psdError)
        throw new Error(`PSD文件解析失败: ${psdError instanceof Error ? psdError.message : 'Unknown error'}`)
      }

      // 提取缩略图
      let thumbnailBytes: ArrayBuffer | undefined
      let thumbnailMimeType: string | undefined

      // 方法1: 优先使用原始缩略图数据 (thumbnailRaw)
      if (psdData.thumbnailRaw) {
        console.log("[DEBUG] Using PSD raw thumbnail data")
        try {
          const rawData = psdData.thumbnailRaw
          if (rawData instanceof ArrayBuffer) {
            thumbnailBytes = rawData
          } else if (rawData.buffer) {
            thumbnailBytes = rawData.buffer.slice(rawData.byteOffset, rawData.byteOffset + rawData.byteLength)
          } else {
            // 如果是其他类型的数据，转换为ArrayBuffer
            const uint8Array = new Uint8Array(rawData)
            thumbnailBytes = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength)
          }
          thumbnailMimeType = 'image/jpeg' // PSD原始缩略图通常是JPEG格式
          console.log("[DEBUG] Raw thumbnail found, size:", thumbnailBytes?.byteLength || 0, "bytes")
        } catch (rawError) {
          console.log("[DEBUG] Raw thumbnail processing failed:", rawError)
          thumbnailBytes = undefined as any
        }
      }

      // 方法2: 使用解码后的缩略图数据
      if (!thumbnailBytes && psdData.thumbnail) {
        console.log("[DEBUG] Using PSD decoded thumbnail")
        try {
          if (psdData.thumbnail.data) {
            const thumbData = psdData.thumbnail.data
            if (thumbData instanceof ArrayBuffer) {
              thumbnailBytes = thumbData
            } else if (thumbData.buffer) {
              thumbnailBytes = thumbData.buffer.slice(thumbData.byteOffset, thumbData.byteOffset + thumbData.byteLength)
            } else {
              const uint8Array = new Uint8Array(thumbData)
              thumbnailBytes = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength)
            }
            thumbnailMimeType = 'image/jpeg'
            console.log("[DEBUG] Decoded thumbnail found, size:", thumbnailBytes?.byteLength || 0, "bytes")
          }
        } catch (thumbError) {
          console.log("[DEBUG] Decoded thumbnail processing failed:", thumbError)
          thumbnailBytes = undefined as any
        }
      }

      // 方法3: 使用imageData转换为PNG
      if (!thumbnailBytes && psdData.imageData) {
        console.log("[DEBUG] Converting PSD imageData to PNG using sharp...")
        try {
          const imageData = psdData.imageData
          const width = psdWidth
          const height = psdHeight

          // imageData.data 是一个 Uint8ClampedArray，包含 RGBA 数据
          if (imageData.data && imageData.data.length > 0) {
            console.log("[DEBUG] ImageData dimensions:", width, "x", height)
            console.log("[DEBUG] ImageData buffer size:", imageData.data.length, "bytes")

            // 使用sharp将RGBA数据转换为PNG
            const pngBuffer = await sharp(Buffer.from(imageData.data), {
              raw: {
                width: width,
                height: height,
                channels: 4 // RGBA
              }
            })
            .png()
            .toBuffer()

            // 直接使用Buffer作为ArrayBuffer
            const arrayBuffer = new Uint8Array(pngBuffer).buffer
            thumbnailBytes = arrayBuffer
            thumbnailMimeType = 'image/png'
            console.log("[DEBUG] PNG conversion successful, size:", pngBuffer.length, "bytes")
          }
        } catch (imageDataError) {
          console.log("[DEBUG] ImageData conversion failed:", imageDataError)
          thumbnailBytes = undefined as any
        }
      }

      // 如果所有方法都失败，抛出错误
      if (!thumbnailBytes || !thumbnailMimeType) {
        throw new Error('无法从PSD文件提取或生成图像数据，请检查PSD文件是否损坏')
      }

      imageForAnalysis = {
        bytes: thumbnailBytes as ArrayBuffer,
        mimeType: thumbnailMimeType as string,
        fileName: file.name.replace('.psd',
          thumbnailMimeType === 'image/jpeg' ? '.jpg' :
          thumbnailMimeType === 'image/png' ? '.png' : '.jpg')
      }
    } else if (isPdf) {
      console.log("[DEBUG] Processing PDF file...")

      // 保存原始PDF文件引用
      originalPdfFile = file

      try {
        // 读取PDF文件
        console.log("[DEBUG] Reading PDF file bytes...")
        const pdfBytes = await file.arrayBuffer()
        console.log("[DEBUG] PDF file size:", pdfBytes.byteLength, "bytes")

        // 使用pdfjs-dist将PDF第一页转换为PNG
        console.log("[DEBUG] Converting PDF first page to PNG using pdfjs-dist...")
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
        
        // 加载PDF文档
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(pdfBytes),
          useSystemFonts: true,
        })
        const pdfDocument = await loadingTask.promise
        
        console.log("[DEBUG] PDF loaded, pages:", pdfDocument.numPages)
        
        // 获取第一页
        const page = await pdfDocument.getPage(1)
        const viewport = page.getViewport({ scale: 2.0 })
        
        console.log("[DEBUG] Page viewport:", viewport.width, "x", viewport.height)
        
        // 创建canvas来渲染PDF
        const Canvas = (await import('canvas')).default
        const canvas = Canvas.createCanvas(viewport.width, viewport.height)
        const context = canvas.getContext('2d')
        
        // 渲染PDF页面到canvas
        await page.render({
          canvasContext: context as any,
          viewport: viewport,
          canvas: canvas as any,
        }).promise
        
        console.log("[DEBUG] PDF page rendered to canvas")
        
        // 将canvas转换为PNG buffer
        const pngBuffer = canvas.toBuffer('image/png')
        console.log("[DEBUG] PNG buffer created, size:", pngBuffer.length, "bytes")
        
        // 转换为ArrayBuffer
        const arrayBuffer = pngBuffer.buffer.slice(pngBuffer.byteOffset, pngBuffer.byteOffset + pngBuffer.byteLength) as ArrayBuffer
        
        imageForAnalysis = {
          bytes: arrayBuffer,
          mimeType: 'image/png',
          fileName: file.name.replace('.pdf', '.png')
        }

      } catch (pdfError) {
        console.error("[ERROR] PDF processing failed:", pdfError)
        console.error("[ERROR] PDF error stack:", pdfError instanceof Error ? pdfError.stack : 'No stack')
        console.error("[ERROR] PDF error details:", JSON.stringify(pdfError, null, 2))
        throw new Error(`PDF文件处理失败: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`)
      }
    } else {
      // 普通图片文件
      const bytes = await file.arrayBuffer()
      imageForAnalysis = {
        bytes,
        mimeType: file.type,
        fileName: file.name
      }
    }

    // Convert image to base64 for AI analysis
    const base64 = Buffer.from(imageForAnalysis.bytes).toString("base64")
    const mimeType = imageForAnalysis.mimeType

    console.log("[DEBUG] Starting material analysis for file:", imageForAnalysis.fileName)
    console.log("[DEBUG] File size:", imageForAnalysis.bytes.byteLength, "bytes")
    console.log("[DEBUG] MIME type:", mimeType)

    // Call OpenRouter API with vision model
    console.log("[DEBUG] Calling OpenRouter API...")
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
      const errorText = await response.text()
      console.error("[ERROR] OpenRouter API error:", response.status, response.statusText)
      console.error("[ERROR] OpenRouter error details:", errorText)
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log("[v0] OpenRouter response received")

    const content = data.choices[0]?.message?.content
    if (!content) {
      throw new Error("No content in OpenRouter response")
    }

    // Parse JSON response
    let analysisResult
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0])
      } else {
        analysisResult = JSON.parse(content)
      }
    } catch (parseError) {
      console.log("[v0] Failed to parse JSON, using fallback")
      // Fallback if JSON parsing fails
      analysisResult = {
        tags: ["动漫风格", "插画素材"],
        chinese_prompt: "动漫风格的插画素材",
        english_prompt: "anime style illustration material",
      }
    }

    console.log("[v0] Analysis completed successfully")

    // 如果只是分析模式，直接返回分析结果
    if (isAnalysisOnly) {
      console.log("[v0] Analysis-only mode, skipping file upload and database save")

      // 如果是PSD或PDF文件，返回转换后的PNG图片的base64数据
      let previewImageBase64: string | undefined
      if ((isPsd || isPdf) && imageForAnalysis) {
        const base64 = Buffer.from(imageForAnalysis.bytes).toString('base64')
        previewImageBase64 = `data:${imageForAnalysis.mimeType};base64,${base64}`
        console.log("[DEBUG] Created preview image base64 for", isPsd ? "PSD" : "PDF", "file")
      }

      return NextResponse.json({
        success: true,
        analysis: analysisResult,
        previewImage: previewImageBase64, // 返回转换后的图片数据
      })
    }

    // Initialize Supabase clients
    const supabase = createServerClient() // 用于数据库操作
    
    // 创建专门用于文件上传的客户端（不使用cookies）
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    console.log('[Storage] Using key type:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon')
    console.log('[Storage] Supabase URL:', supabaseUrl)
    
    const storageClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    })

    // 上传原始PSD/PDF文件（如果是PSD或PDF）
    let originalFileUrl: string | null = null

    if (isPsd && originalPsdFile) {
      const originalFileName = `originals/${Date.now()}-${Math.random().toString(36).substring(2)}.psd`

      console.log("[v0] Uploading original PSD file to storage:", originalFileName)

      const { data: originalUploadData, error: originalUploadError } = await storageClient.storage
        .from("material")
        .upload(originalFileName, originalPsdFile, {
          contentType: "application/octet-stream",
          upsert: false,
        })

      if (originalUploadError) {
        console.error("[ERROR] ===== Original PSD upload error =====")
        console.error("[ERROR] Error message:", originalUploadError.message)
        console.error("[ERROR] Error object:", JSON.stringify(originalUploadError, null, 2))
        console.error("[ERROR] File name:", originalFileName)
        console.error("[ERROR] File size:", originalPsdFile.size)
        console.error("[ERROR] ========================================")
        throw new Error(`Failed to upload original PSD: ${originalUploadError.message}`)
      }

      console.log("[v0] Original PSD uploaded successfully:", originalUploadData.path)

      // Get public URL for the original PSD file
      const { data: originalUrlData } = storageClient.storage.from("material").getPublicUrl(originalFileName)
      originalFileUrl = originalUrlData.publicUrl
    } else if (isPdf && originalPdfFile) {
      const originalFileName = `originals/${Date.now()}-${Math.random().toString(36).substring(2)}.pdf`

      console.log("[v0] Uploading original PDF file to storage:", originalFileName)

      const { data: originalUploadData, error: originalUploadError } = await storageClient.storage
        .from("material")
        .upload(originalFileName, originalPdfFile, {
          contentType: "application/pdf",
          upsert: false,
        })

      if (originalUploadError) {
        console.error("[ERROR] ===== Original PDF upload error =====")
        console.error("[ERROR] Error message:", originalUploadError.message)
        console.error("[ERROR] Error object:", JSON.stringify(originalUploadError, null, 2))
        console.error("[ERROR] File name:", originalFileName)
        console.error("[ERROR] File size:", originalPdfFile.size)
        console.error("[ERROR] ========================================")
        throw new Error(`Failed to upload original PDF: ${originalUploadError.message}`)
      }

      console.log("[v0] Original PDF uploaded successfully:", originalUploadData.path)

      // Get public URL for the original PDF file
      const { data: originalUrlData } = storageClient.storage.from("material").getPublicUrl(originalFileName)
      originalFileUrl = originalUrlData.publicUrl
    }

    // Generate unique filename for thumbnail/image based on actual mime type
    const extFromMime = (mime: string) => mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : (fileExtension || 'bin')
    const thumbnailExtension = extFromMime(imageForAnalysis.mimeType)
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${thumbnailExtension}`

    console.log("[v0] Uploading thumbnail/image to storage:", uniqueFileName)

    // Upload thumbnail/image to Supabase storage
    const thumbnailBlob = new Blob([imageForAnalysis.bytes], { type: imageForAnalysis.mimeType })
    const { data: uploadData, error: uploadError } = await storageClient.storage
      .from("material")
      .upload(uniqueFileName, thumbnailBlob, {
        contentType: imageForAnalysis.mimeType,
        upsert: false,
      })

    if (uploadError) {
      console.error("[ERROR] ===== Storage upload error details =====")
      console.error("[ERROR] Error message:", uploadError.message)
      console.error("[ERROR] Error name:", uploadError.name)
      console.error("[ERROR] Status code:", (uploadError as any).statusCode)
      console.error("[ERROR] Error object:", JSON.stringify(uploadError, null, 2))
      console.error("[ERROR] File name:", uniqueFileName)
      console.error("[ERROR] File size:", thumbnailBlob.size)
      console.error("[ERROR] Content type:", imageForAnalysis.mimeType)
      console.error("[ERROR] Bucket:", "material")
      console.error("[ERROR] ==========================================")
      
      // 如果上传失败，清理已上传的原始PSD文件
      if (originalFileUrl) {
        const originalFileName = originalFileUrl.split('/').pop()
        if (originalFileName) {
          await storageClient.storage.from("material").remove([`originals/${originalFileName}`])
        }
      }
      throw new Error(`Failed to upload file: ${uploadError.message}`)
    }

    console.log("[v0] File uploaded successfully:", uploadData.path)

    // Get public URL for the uploaded file
    const { data: urlData } = storageClient.storage.from("material").getPublicUrl(uniqueFileName)

    // 确定主分类和细分类
    const characterCategories = ['ancient-male', 'ancient-female', 'modern-male', 'modern-female', 'fantasy']
    const categoryType = characterCategories.includes(category) ? 'character' : 'scene'

    console.log("[DEBUG] Saving material with category:", category, "categoryType:", categoryType)
    console.log("[DEBUG] Analysis result:", analysisResult)

    // Save material data to database
    const { data: materialData, error: dbError } = await supabase
      .from("materials")
      .insert({
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
        image_url: urlData.publicUrl,
        file_type: fileExtension || "unknown",
        original_filename: file.name,
        category_type: categoryType,
        subcategory: category, // 保存细分类
        tags: userTags ? userTags.split(",").map(tag => tag.trim()).filter(tag => tag) : analysisResult.tags,
        chinese_prompt: userChinesePrompt || analysisResult.chinese_prompt,
        english_prompt: userEnglishPrompt || analysisResult.english_prompt,
        // 注意：original_file_url 和 file_format 字段不存在于materials表
      })
      .select()
      .single()

    if (dbError) {
      console.error("[v0] Database save error:", dbError)
      // Clean up uploaded file if database save fails
      await storageClient.storage.from("material").remove([uniqueFileName])
      throw new Error(`Failed to save material data: ${dbError.message}`)
    }

    console.log("[v0] Material saved to database successfully")

    return NextResponse.json({
      success: true,
      analysis: analysisResult,
      material: materialData,
    })
  } catch (error) {
    console.error("[ERROR] Material analysis error:", error)
    console.error("[ERROR] Error stack:", error instanceof Error ? error.stack : 'No stack trace')
    console.error("[ERROR] Error name:", error instanceof Error ? error.name : 'Unknown')
    console.error("[ERROR] Error message:", error instanceof Error ? error.message : 'Unknown error')

    // 提供更详细的错误信息
    let errorMessage = "Failed to analyze material"
    let errorDetails = "Unknown error"

    if (error instanceof Error) {
      errorDetails = error.message

      // 根据错误类型提供更具体的错误信息
      if (error.message.includes('Canvas')) {
        errorMessage = "Canvas库处理失败"
        errorDetails = `Canvas处理错误: ${error.message}. 请检查服务器环境是否正确安装了Canvas依赖。`
      } else if (error.message.includes('PSD')) {
        errorMessage = "PSD文件处理失败"
        errorDetails = `PSD解析错误: ${error.message}`
      } else if (error.message.includes('OpenRouter')) {
        errorMessage = "AI分析服务失败"
        errorDetails = `OpenRouter API错误: ${error.message}`
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString()
      },
      { status: 500 },
    )
  }
}
