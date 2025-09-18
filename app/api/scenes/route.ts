import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scriptId = searchParams.get("script_id")
    const history = searchParams.get("history")

    // 如果请求历史记录
    if (history === "true") {
      try {
        const { data: historyData, error } = await supabase
          .from("scene_prompts_history")
          .select(`
            id,
            script_title,
            created_at,
            scenes
          `)
          .order("created_at", { ascending: false })
          .limit(20) // 限制返回最近20条记录

        if (error) {
          console.error("History table error:", error)
          // 如果表不存在，返回空数组
          return NextResponse.json([])
        }

        return NextResponse.json(historyData || [])
      } catch (error) {
        console.error("Error fetching scene history:", error)
        return NextResponse.json([])
      }
    }

    // 原有的场景查询逻辑
    let query = supabase.from("scenes").select("*")

    if (scriptId) {
      query = query.eq("script_id", scriptId)
    }

    const { data: scenes, error } = await query.order("created_at", { ascending: false })

    if (error) throw error

    const scenesWithMaterials = await Promise.all(
      scenes.map(async (scene) => {
        // Extract keywords from scene description for matching
        const keywords = scene.description
          .toLowerCase()
          .split(/[，。！？\s,.!?]+/)
          .filter(Boolean)

        // Find matching materials based on tags and category
        const { data: materials } = await supabase
          .from("materials")
          .select("*")
          .eq("category_type", "scene")
          .or(keywords.map((keyword: string) => `tags.cs.{${keyword}}`).join(","))
          .limit(3)

        return {
          ...scene,
          matched_materials: materials || [],
        }
      }),
    )

    return NextResponse.json(scenesWithMaterials)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch scenes" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const sceneData = await request.json()

    const { data: scene, error } = await supabase.from("scenes").insert([sceneData]).select().single()

    if (error) throw error

    return NextResponse.json(scene)
  } catch (error) {
    return NextResponse.json({ error: "Failed to create scene" }, { status: 500 })
  }
}
