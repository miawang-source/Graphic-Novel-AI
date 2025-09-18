import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch (formDataError) {
      console.error("[DEBUG] FormData解析失败:", formDataError)
      return NextResponse.json({ error: "请求格式错误，请确保使用multipart/form-data格式上传文件" }, { status: 400 })
    }

    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: "没有上传文件" }, { status: 400 })
    }

    let content = ""
    const fileName = file.name.toLowerCase()
    
    console.log("[DEBUG] 服务端解析文档:", {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size
    })
    
    if (fileName.endsWith('.docx')) {
      try {
        // 动态导入mammoth（仅在服务端使用）
        const mammoth = await import('mammoth')
        const arrayBuffer = await file.arrayBuffer()

        console.log("[DEBUG] DOCX文件信息:", {
          fileName: file.name,
          fileSize: file.size,
          arrayBufferSize: arrayBuffer.byteLength
        })

        // 正确的mammoth API调用方式 - 使用buffer而不是arrayBuffer
        const buffer = Buffer.from(arrayBuffer)

        console.log("[DEBUG] 开始解析DOCX文件...")
        const result = await mammoth.extractRawText({
          buffer: buffer
        })
        content = result.value

        console.log("[DEBUG] mammoth返回结果:", {
          hasValue: !!result.value,
          valueLength: result.value?.length || 0,
          hasMessages: !!result.messages,
          messagesCount: result.messages?.length || 0
        })

        console.log("[DEBUG] DOCX解析成功:", {
          textLength: content.length,
          messages: result.messages?.length || 0,
          contentPreview: content.substring(0, 200) + "..."
        })

        if (!content.trim()) {
          throw new Error("DOCX文件中没有可提取的文本内容")
        }
      } catch (docxError) {
        console.error("[DEBUG] DOCX解析失败:", docxError)

        // 提供更详细的错误信息
        let errorMsg = "DOCX文件解析失败"
        if (docxError instanceof Error) {
          if (docxError.message.includes('Could not find file')) {
            errorMsg = "DOCX文件格式错误或文件损坏"
          } else if (docxError.message.includes('zip')) {
            errorMsg = "DOCX文件压缩格式错误"
          } else {
            errorMsg = `DOCX解析错误: ${docxError.message}`
          }
        }

        throw new Error(errorMsg)
      }
    } else if (fileName.endsWith('.txt') || file.type === "text/plain") {
      // 纯文本文件
      content = await file.text()
      
      if (!content.trim()) {
        throw new Error("文本文件内容为空")
      }
    } else {
      throw new Error(`不支持的文件格式：${fileName.split('.').pop()?.toUpperCase()}。支持的格式：.txt（纯文本）、.docx（Word文档）`)
    }

    return NextResponse.json({
      success: true,
      content: content,
      title: file.name.replace(/\.[^/.]+$/, ""),
      fileInfo: {
        name: file.name,
        size: file.size,
        type: file.type,
        contentLength: content.length
      }
    })
  } catch (error) {
    console.error("Document parsing error:", error)
    
    let errorMessage = "文档解析失败"
    if (error instanceof Error) {
      errorMessage = error.message
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
        details: "请确保文件格式正确且未损坏。支持的格式：.txt（纯文本）、.docx（Word文档）"
      },
      { status: 500 }
    )
  }
}
