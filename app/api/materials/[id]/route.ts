import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // 尝试使用 service role key，如果不存在则使用普通客户端
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

    let supabase
    if (serviceRoleKey) {
      // 生产环境：使用 service role key
      supabase = createClient(supabaseUrl, serviceRoleKey)
    } else {
      // 开发环境：使用普通客户端
      supabase = createServerClient()
    }

    // 首先获取素材信息，包括图片URL
    const { data: material, error: fetchError } = await supabase
      .from('materials')
      .select('image_url')
      .eq('id', id)
      .single()

    if (fetchError || !material) {
      return NextResponse.json(
        { success: false, error: '素材不存在' },
        { status: 404 }
      )
    }

    // 从存储桶中删除图片文件
    if (material.image_url) {
      // 从URL中提取文件路径
      const url = new URL(material.image_url)
      const pathParts = url.pathname.split('/')
      const bucketName = pathParts[pathParts.length - 2] // 倒数第二个部分是bucket名
      const fileName = pathParts[pathParts.length - 1] // 最后一个部分是文件名

      if (bucketName && fileName) {
        const { error: storageError } = await supabase.storage
          .from(bucketName)
          .remove([fileName])

        if (storageError) {
          console.error('删除存储文件失败:', storageError)
          // 继续删除数据库记录，即使文件删除失败
        }
      }
    }

    // 从数据库中删除记录
    const { error: deleteError } = await supabase
      .from('materials')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json(
        { success: false, error: '删除数据库记录失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('删除素材失败:', error)
    return NextResponse.json(
      { success: false, error: '删除失败' },
      { status: 500 }
    )
  }
}
