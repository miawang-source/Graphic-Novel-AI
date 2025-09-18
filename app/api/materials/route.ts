import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryType = searchParams.get("category_type")
    const subcategory = searchParams.get("subcategory")

    console.log("[DEBUG] Materials API - categoryType:", categoryType, "subcategory:", subcategory)

    let query = supabase.from("materials").select("*")

    if (categoryType) {
      query = query.eq("category_type", categoryType)
    }

    if (subcategory) {
      query = query.eq("subcategory", subcategory)
    }

    const { data: materials, error } = await query.order("created_at", { ascending: false })

    if (error) {
      console.error("[DEBUG] Materials query error:", error)
      throw error
    }

    console.log("[DEBUG] Materials found:", materials?.length || 0)

    // 调试：打印前几个材料的 subcategory 值
    if (materials && materials.length > 0) {
      console.log("[DEBUG] Sample materials subcategories:",
        materials.slice(0, 5).map(m => ({ id: m.id, subcategory: m.subcategory, category_type: m.category_type }))
      )
    }

    return NextResponse.json(materials)
  } catch (error) {
    console.error("[DEBUG] Materials API error:", error)
    return NextResponse.json({ error: "Failed to fetch materials" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const materialData = await request.json()

    const { data: material, error } = await supabase.from("materials").insert([materialData]).select().single()

    if (error) throw error

    return NextResponse.json(material)
  } catch (error) {
    return NextResponse.json({ error: "Failed to create material" }, { status: 500 })
  }
}
