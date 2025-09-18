import { createBrowserClient, createServerClient as createSupabaseServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gyafalegiojqnzyfasvb.supabase.co"
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5YWZhbGVnaW9qcW56eWZhc3ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NjI1NTksImV4cCI6MjA3MzAzODU1OX0.i3bRWO7wlTsmRIhVOLG3bV7CELIOqoFAlJ5wLtS2B9o"

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

export function createServerClient() {
  const cookieStore = cookies()

  return createSupabaseServerClient(supabaseUrl, supabaseAnonKey, {
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
}

export function createServerSupabaseClient() {
  const cookieStore = cookies()

  return createSupabaseServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
    },
  })
}
