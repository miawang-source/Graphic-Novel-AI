import { createBrowserClient, createServerClient as createSupabaseServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gyafalegiojqnzyfasvb.supabase.co"
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5YWZhbGVnaW9qcW56eWZhc3ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NjI1NTksImV4cCI6MjA3MzAzODU1OX0.i3bRWO7wlTsmRIhVOLG3bV7CELIOqoFAlJ5wLtS2B9o"

// Service role key用于服务端操作（如文件上传），权限更高
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

// 创建专门用于服务端文件上传的客户端（不使用cookies，使用service role key）
export function createStorageClient() {
  // 优先使用service role key，如果没有则使用anon key
  const key = supabaseServiceKey || supabaseAnonKey
  
  if (supabaseServiceKey) {
    console.log('[Supabase Storage] Using service role key')
  } else {
    console.log('[Supabase Storage] Warning: Using anon key, uploads may fail without proper policies')
  }
  
  // 直接创建客户端，不使用cookies
  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  })
}

export function createServerClient() {
  const cookieStore = cookies()

  // 优先使用service role key（用于文件上传等需要更高权限的操作）
  const key = supabaseServiceKey || supabaseAnonKey
  
  if (supabaseServiceKey) {
    console.log('[Supabase] Using service role key for server operations')
  } else {
    console.log('[Supabase] Warning: Using anon key, file uploads may fail. Please set SUPABASE_SERVICE_ROLE_KEY')
  }

  return createSupabaseServerClient(supabaseUrl, key, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
    },
  })
}

// 类型定义
export interface Script {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export interface Character {
  id: string
  script_id: string
  name: string
  description: string
  chinese_prompt: string
  english_prompt: string
  role_type: "main" | "supporting"
  created_at: string
}

export interface Scene {
  id: string
  script_id: string
  name: string
  description: string
  chinese_prompt: string
  english_prompt: string
  created_at: string
}

export interface Category {
  id: string
  name: string
  type: "character" | "scene"
  created_at: string
}

export interface Material {
  id: string
  category_id: string
  title: string
  image_url: string
  tags: string[]
  chinese_prompt: string
  english_prompt: string
  download_count: number
  created_at: string
  original_file_url?: string  // 原始PSD文件URL
  file_format?: string        // 文件格式 (png/jpg/psd等)
  file_type?: string         // 保持向后兼容
  original_filename?: string // 原始文件名
}

export function createServerSupabaseClient() {
  const cookieStore = cookies()

  // 优先使用service role key
  const key = supabaseServiceKey || supabaseAnonKey

  return createSupabaseServerClient(supabaseUrl, key, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
    },
  })
}
