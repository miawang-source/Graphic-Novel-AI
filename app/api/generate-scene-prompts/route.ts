import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { handleOpenRouterError, validateOpenRouterKey } from "@/lib/api-utils"

async function findMatchingMaterial(promptData: any, supabase: any) {
  try {
    // 获取场景类型的素材
    const { data: materials, error } = await supabase.from("materials").select("*").eq("category_type", "scene")

    if (error || !materials || materials.length === 0) {
      return null
    }

    // 提取关键词进行匹配
    const promptKeywords = [
      ...(promptData.tags || []),
      ...(promptData.chinese_prompt || "").split(/[，。、\s]+/).filter((word: string) => word.length > 1),
      ...(promptData.english_prompt || "")
        .toLowerCase()
        .split(/[,.\s]+/)
        .filter((word: string) => word.length > 2),
    ]

    let bestMatch = null
    let highestScore = 0

    for (const material of materials) {
      let score = 0
      const materialKeywords = [
        ...(material.tags || []),
        ...(material.chinese_prompt || "").split(/[，。、\s]+/).filter((word: string) => word.length > 1),
        ...(material.english_prompt || "")
          .toLowerCase()
          .split(/[,.\s]+/)
          .filter((word: string) => word.length > 2),
      ]

      // 计算关键词匹配分数
      for (const promptKeyword of promptKeywords) {
        for (const materialKeyword of materialKeywords) {
          if (promptKeyword.includes(materialKeyword) || materialKeyword.includes(promptKeyword)) {
            score += 2 // 完全匹配
          } else if (promptKeyword.toLowerCase() === materialKeyword.toLowerCase()) {
            score += 3 // 精确匹配
          }
        }
      }

      // 标签权重更高
      if (material.tags && promptData.tags) {
        for (const tag of promptData.tags) {
          if (material.tags.includes(tag)) {
            score += 5
          }
        }
      }

      if (score > highestScore) {
        highestScore = score
        bestMatch = material
      }
    }

    return highestScore > 3 ? bestMatch : null
  } catch (error) {
    console.error("Error finding matching material:", error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { scenes, scriptTitle, scriptId } = await request.json()

    console.log("[v0] Scene prompts generation started:", {
      scenesCount: scenes?.length,
      scriptTitle,
      scriptId,
    })

    if (!scenes || !Array.isArray(scenes)) {
      return NextResponse.json({ success: false, error: "无效的场景数据" }, { status: 400 })
    }

    const supabase = createServerClient()
    const generatedPrompts = []

    let finalScriptId = scriptId
    if (!finalScriptId) {
      const { data: scriptData, error: scriptError } = await supabase
        .from("scripts")
        .insert({
          title: scriptTitle || "未命名剧本",
          content: "AI分析生成的剧本",
        })
        .select()
        .single()

      if (scriptError) {
        console.error("[v0] Failed to create script:", scriptError)
        return NextResponse.json({ success: false, error: "创建剧本记录失败" }, { status: 500 })
      }
      finalScriptId = scriptData.id
      console.log("[v0] Created new script with ID:", finalScriptId)
    }

    for (const scene of scenes) {
      try {
        console.log("[v0] Processing scene:", scene.name)

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-1.5-flash",
            messages: [
              {
                role: "system",
                content: `你是一个专业的图片内容分析师，专门为动漫插画素材生成标签和绘画提示词。

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

输出格式：
{
  "tags": ["标签1", "标签2", "标签3"],
  "chinese_prompt": "详细的中文绘画描述",
  "english_prompt": "detailed English prompt for AI image generation"
}`,
              },
              {
                role: "user",
                content: `请为以下场景生成绘画提示词：

场景名称：${scene.name}
场景描述：${scene.description}

请生成适合动漫插画风格的标签和提示词。`,
              },
            ],
            temperature: 0.7,
            max_tokens: 1000,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const errorMessage = handleOpenRouterError(response, errorData)
          throw new Error(errorMessage)
        }

        const data = await response.json()
        const content = data.choices[0]?.message?.content

        if (!content) {
          throw new Error("No content received from AI")
        }

        // 尝试解析JSON响应
        let promptData
        try {
          promptData = JSON.parse(content)
        } catch {
          console.log("[v0] JSON parsing failed, trying to extract from text:", content)
          // 如果JSON解析失败，尝试从文本中提取
          const chineseMatch = content.match(/中文提示词[：:]\s*([^\n]+)/i) ||
                              content.match(/chinese_prompt[\"']?\s*:\s*[\"']([^\"']+)[\"']/i)
          const englishMatch = content.match(/英文提示词[：:]\s*([^\n]+)/i) ||
                              content.match(/english_prompt[\"']?\s*:\s*[\"']([^\"']+)[\"']/i)

          promptData = {
            tags: [scene.name, "场景", "动漫风格"],
            chinese_prompt: chineseMatch ? chineseMatch[1].trim() : `${scene.name}场景，${scene.description}，动漫风格，高质量插画`,
            english_prompt: englishMatch ? englishMatch[1].trim() : `${scene.name}, ${scene.description}, anime style, high quality illustration`,
          }
          console.log("[v0] Extracted prompts:", promptData)
        }

        const matchedMaterial = await findMatchingMaterial(promptData, supabase)

        if (finalScriptId) {
          console.log("[v0] Checking for existing scene:", scene.name, "with scriptId:", finalScriptId)
          const { data: existingScene } = await supabase
            .from("scenes")
            .select("id")
            .eq("script_id", finalScriptId)
            .eq("name", scene.name)
            .single()

          if (existingScene) {
            // 更新现有场景
            console.log("[v0] Updating existing scene:", scene.name)
            const { error: updateError } = await supabase
              .from("scenes")
              .update({
                description: scene.description,
                chinese_prompt: promptData.chinese_prompt || `${scene.name}场景，${scene.description}，动漫风格，高质量插画`,
                english_prompt: promptData.english_prompt || `${scene.name}, ${scene.description}, anime style, high quality illustration`,
              })
              .eq("id", existingScene.id)

            if (updateError) {
              console.error(`[v0] Failed to update scene ${scene.name}:`, updateError)
            } else {
              console.log("[v0] Scene updated successfully:", scene.name)
            }
          } else {
            // 插入新场景
            console.log("[v0] Inserting new scene:", scene.name)
            const { error: insertError } = await supabase.from("scenes").insert({
              script_id: finalScriptId,
              name: scene.name,
              description: scene.description,
              chinese_prompt: promptData.chinese_prompt || `${scene.name}场景，${scene.description}，动漫风格，高质量插画`,
              english_prompt: promptData.english_prompt || `${scene.name}, ${scene.description}, anime style, high quality illustration`,
            })

            if (insertError) {
              console.error(`[v0] Failed to insert scene ${scene.name}:`, insertError)
            } else {
              console.log("[v0] Scene inserted successfully:", scene.name)
            }
          }
        }

        generatedPrompts.push({
          name: scene.name,
          description: scene.description,
          tags: promptData.tags || [],
          chinese_prompt: promptData.chinese_prompt || `${scene.name}场景，${scene.description}，动漫风格，高质量插画`,
          english_prompt: promptData.english_prompt || `${scene.name}, ${scene.description}, anime style, high quality illustration`,
          matchedMaterial: matchedMaterial, // 添加匹配的素材数据
        })
      } catch (error) {
        console.error(`[v0] Error generating prompt for ${scene.name}:`, error)
        // 添加默认提示词作为后备
        generatedPrompts.push({
          name: scene.name,
          description: scene.description,
          tags: [scene.name, "场景"],
          chinese_prompt: `${scene.name}场景，${scene.description}，动漫风格，高质量插画`,
          english_prompt: `${scene.name}, ${scene.description}, anime style, high quality illustration`,
          matchedMaterial: null, // 添加空的匹配素材
        })
      }
    }

    console.log("[v0] Scene prompts generation completed:", generatedPrompts.length)

    // 保存到历史记录表
    try {
      const { error: historyError } = await supabase
        .from("scene_prompts_history")
        .insert({
          script_title: scriptTitle,
          script_id: finalScriptId,
          scenes: generatedPrompts,
          created_at: new Date().toISOString()
        })

      if (historyError) {
        console.error("Failed to save scene prompts history:", historyError)
      } else {
        console.log("[DEBUG] Scene prompts history saved successfully")
      }
    } catch (historyError) {
      console.error("Error saving scene prompts history:", historyError)
    }

    return NextResponse.json({
      success: true,
      data: {
        scriptTitle,
        scriptId: finalScriptId, // 返回finalScriptId而不是原始scriptId
        scenes: generatedPrompts,
      },
    })
  } catch (error) {
    console.error("[v0] Generate scene prompts error:", error)
    return NextResponse.json({ success: false, error: "生成场景提示词失败" }, { status: 500 })
  }
}
