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
          .from("character_prompts_history")
          .select(`
            id,
            script_title,
            created_at,
            characters
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
        console.error("Error fetching character history:", error)
        return NextResponse.json([])
      }
    }

    // 原有的角色查询逻辑
    let query = supabase.from("characters").select("*")

    if (scriptId) {
      query = query.eq("script_id", scriptId)
    }

    const { data: characters, error } = await query.order("created_at", { ascending: false })

    if (error) throw error

    const charactersWithMaterials = await Promise.all(
      characters.map(async (character) => {
        // Simple keyword matching - look for materials with matching tags
        const keywords = character.name.split(" ").concat(character.description.split(" "))

        const { data: materials } = await supabase
          .from("materials")
          .select("*")
          .eq("category_type", "character")
          .limit(1) // Get one matching material per character

        return {
          ...character,
          matched_material: materials?.[0] || null,
        }
      }),
    )

    return NextResponse.json(charactersWithMaterials)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch characters" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const characterData = await request.json()

    const { data: character, error } = await supabase.from("characters").insert([characterData]).select().single()

    if (error) throw error

    return NextResponse.json(character)
  } catch (error) {
    return NextResponse.json({ error: "Failed to create character" }, { status: 500 })
  }
}
