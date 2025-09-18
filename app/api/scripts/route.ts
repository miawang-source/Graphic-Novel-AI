import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    const { data: scripts, error } = await supabase
      .from("scripts")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json(scripts)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch scripts" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title, content } = await request.json()

    const { data: script, error } = await supabase.from("scripts").insert([{ title, content }]).select().single()

    if (error) throw error

    return NextResponse.json(script)
  } catch (error) {
    return NextResponse.json({ error: "Failed to create script" }, { status: 500 })
  }
}
