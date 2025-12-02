# Supabase存储桶上传失败修复指南

## 🔴 问题现象

- ✅ AI解析成功
- ✅ PSD/PDF转图片成功
- ❌ 上传到Supabase存储桶失败（500错误）

## 🔍 问题原因

从错误信息看，这是Supabase存储桶的权限或配置问题，不是文件格式问题。

## ✅ 解决方案

### 方案1：检查并修复存储桶权限（最可能）

#### 1.1 登录Supabase Dashboard

访问：https://supabase.com/dashboard

#### 1.2 进入Storage设置

1. 选择你的项目
2. 点击左侧菜单 `Storage`
3. 找到 `material` 存储桶

#### 1.3 检查存储桶策略（Policies）

点击 `material` 存储桶，然后点击 `Policies` 标签，确保有以下策略：

**策略1：允许认证用户上传**
```sql
-- Policy Name: Allow authenticated uploads
-- Operation: INSERT
-- Target roles: authenticated

CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'material'
);
```

**策略2：允许公共读取**
```sql
-- Policy Name: Public Access
-- Operation: SELECT
-- Target roles: public, anon

CREATE POLICY "Public Access"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'material'
);
```

**策略3：允许服务角色完全访问（重要！）**
```sql
-- Policy Name: Service role access
-- Operation: ALL
-- Target roles: service_role

CREATE POLICY "Service role access"
ON storage.objects
FOR ALL
TO service_role
USING (
  bucket_id = 'material'
);
```

#### 1.4 使用Supabase Dashboard添加策略

如果没有这些策略，在Dashboard中添加：

1. 点击 `New Policy`
2. 选择 `For full customization`
3. 填写策略名称
4. 选择操作类型（INSERT, SELECT, ALL等）
5. 填写策略表达式
6. 点击 `Save`

### 方案2：检查存储桶配置

#### 2.1 存储桶设置

在 `material` 存储桶设置中检查：

- ✅ **Public bucket**: 应该开启（允许公共读取）
- ✅ **File size limit**: 至少500MB
- ✅ **Allowed MIME types**: 留空或包含 `application/octet-stream`, `application/pdf`, `image/*`

#### 2.2 修改存储桶设置

```sql
-- 如果需要通过SQL修改
UPDATE storage.buckets
SET public = true,
    file_size_limit = 524288000  -- 500MB in bytes
WHERE id = 'material';
```

### 方案3：使用Service Role Key

当前代码可能使用的是anon key，改用service role key可以绕过RLS限制。

#### 3.1 检查环境变量

确保生产环境配置了：

```env
# 当前使用（可能权限不足）
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# 建议添加（服务端使用，权限更高）
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### 3.2 修改代码使用Service Role Key

修改 `lib/supabase.ts`：

```typescript
import { createClient } from '@supabase/supabase-js'

export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  
  // 服务端使用service role key（权限更高）
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  })
}
```

### 方案4：检查CORS配置

#### 4.1 Supabase CORS设置

在Supabase Dashboard:
1. Settings → API
2. 检查 `CORS` 配置
3. 确保包含你的域名

#### 4.2 添加允许的域名

```
https://your-domain.com
http://localhost:3000  # 开发环境
```

### 方案5：检查文件大小限制

#### 5.1 Supabase限制

免费版Supabase限制：
- 单文件最大：50MB
- 总存储：1GB

付费版可以更大。

#### 5.2 Next.js限制

检查 `next.config.mjs`：

```javascript
api: {
  bodyParser: {
    sizeLimit: '50mb', // 确保足够大
  },
},
```

## 🚀 快速修复步骤（推荐）

### 步骤1：添加完整的存储桶策略

在Supabase SQL Editor中执行：

```sql
-- 1. 删除现有策略（如果有冲突）
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Service role access" ON storage.objects;

-- 2. 创建新策略
-- 允许所有认证用户上传到material桶
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'material'
);

-- 允许公共读取material桶的文件
CREATE POLICY "Public Access"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'material'
);

-- 允许service_role完全访问（重要！）
CREATE POLICY "Service role access"
ON storage.objects
FOR ALL
TO service_role
USING (
  bucket_id = 'material'
);

-- 允许认证用户更新和删除自己的文件
CREATE POLICY "Allow authenticated updates"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'material'
);

CREATE POLICY "Allow authenticated deletes"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'material'
);
```

### 步骤2：确保存储桶是公共的

```sql
UPDATE storage.buckets
SET public = true
WHERE id = 'material';
```

### 步骤3：添加Service Role Key到环境变量

在生产环境添加：

```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**获取Service Role Key：**
1. Supabase Dashboard
2. Settings → API
3. 复制 `service_role` key（注意：这是敏感信息，不要暴露）

### 步骤4：更新代码使用Service Role Key

修改 `lib/supabase.ts`：

```typescript
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  
  // 优先使用service role key（服务端）
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  console.log('[Supabase] Using key type:', 
    process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon')
  
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  })
}
```

## 🧪 测试验证

### 测试1：使用Supabase CLI测试上传

```bash
# 安装Supabase CLI
npm install -g supabase

# 测试上传
curl -X POST \
  'https://your-project.supabase.co/storage/v1/object/material/test.txt' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: text/plain' \
  --data 'test content'
```

### 测试2：在代码中添加详细日志

在 `app/api/analyze-material/route.ts` 中添加：

```typescript
console.log("[DEBUG] Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log("[DEBUG] Using service role key:", !!process.env.SUPABASE_SERVICE_ROLE_KEY)
console.log("[DEBUG] File size:", thumbnailBlob.size, "bytes")
console.log("[DEBUG] Content type:", imageForAnalysis.mimeType)

const { data: uploadData, error: uploadError } = await supabase.storage
  .from("material")
  .upload(uniqueFileName, thumbnailBlob, {
    contentType: imageForAnalysis.mimeType,
    upsert: false,
  })

if (uploadError) {
  console.error("[ERROR] Upload error details:", {
    message: uploadError.message,
    statusCode: uploadError.statusCode,
    error: uploadError.error,
  })
}
```

## 📊 常见错误码

| 错误码 | 原因 | 解决方案 |
|--------|------|----------|
| 400 | 请求格式错误 | 检查文件格式和大小 |
| 401 | 认证失败 | 检查API密钥 |
| 403 | 权限不足 | 添加存储桶策略 |
| 413 | 文件太大 | 增加大小限制 |
| 500 | 服务器错误 | 检查Supabase服务状态 |

## 🔧 临时解决方案

如果上述方案都不行，可以临时禁用RLS：

```sql
-- ⚠️ 警告：这会完全禁用安全策略，仅用于测试！
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
```

**测试后记得重新启用：**
```sql
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

## 📞 需要提供的信息

如果问题仍未解决，请提供：

1. Supabase项目URL
2. 当前的存储桶策略（截图）
3. 完整的服务器错误日志
4. 文件大小和类型
5. 是否使用了service role key

## 🎯 最可能的解决方案

根据经验，90%的情况是：

1. **缺少service role策略** → 执行步骤1的SQL
2. **使用anon key而非service role key** → 添加环境变量并修改代码
3. **存储桶不是public** → 执行步骤2的SQL

建议按顺序尝试这三个方案。
