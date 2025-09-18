import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

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

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")
    const mimeType = file.type

    console.log("[DEBUG] Starting material analysis for file:", file.name)
    console.log("[DEBUG] File size:", bytes.byteLength, "bytes")
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
      return NextResponse.json({
        success: true,
        analysis: analysisResult,
      })
    }

    // Initialize Supabase client
    const supabase = createServerClient()

    // Generate unique filename
    const fileExtension = file.name.split(".").pop()
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`

    console.log("[v0] Uploading file to storage:", uniqueFileName)

    // Upload file to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("material")
      .upload(uniqueFileName, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error("[v0] Storage upload error:", uploadError)
      throw new Error(`Failed to upload file: ${uploadError.message}`)
    }

    console.log("[v0] File uploaded successfully:", uploadData.path)

    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage.from("material").getPublicUrl(uniqueFileName)

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
      })
      .select()
      .single()

    if (dbError) {
      console.error("[v0] Database save error:", dbError)
      // Clean up uploaded file if database save fails
      await supabase.storage.from("material").remove([uniqueFileName])
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

    return NextResponse.json(
      { error: "Failed to analyze material", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
