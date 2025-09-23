import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // 首先检查角色是否存在
    const { data: character, error: fetchError } = await supabase
      .from('characters')
      .select('id, name')
      .eq('id', id)
      .single()

    if (fetchError || !character) {
      return NextResponse.json(
        { success: false, error: '角色不存在' },
        { status: 404 }
      )
    }

    // 从数据库中删除角色记录
    const { error: deleteError } = await supabase
      .from('characters')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('删除角色失败:', deleteError)
      return NextResponse.json(
        { success: false, error: '删除角色失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      message: `角色 "${character.name}" 删除成功` 
    })

  } catch (error) {
    console.error('删除角色时发生错误:', error)
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    )
  }
}
