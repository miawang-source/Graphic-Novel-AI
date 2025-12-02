# 修复文件上传 - 环境变量配置指南

## 🔴 问题

PSD/PDF文件上传到Supabase存储桶时返回500错误。

## ✅ 解决方案

需要添加`SUPABASE_SERVICE_ROLE_KEY`环境变量，使用更高权限的密钥。

## 📝 配置步骤

### 步骤1：获取Service Role Key

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击左侧 `Settings` → `API`
4. 找到 `Project API keys` 部分
5. 复制 `service_role` 密钥（**注意：这是敏感信息！**）

**示例：**
```
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5YWZhbGVnaW9qcW56eWZhc3ZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MjU1OSwiZXhwIjoyMDczMDM4NTU5fQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 步骤2：添加到环境变量

#### 生产环境（服务器）

在你的服务器环境变量中添加：

```bash
# 方式1：直接在shell中设置
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"

# 方式2：添加到.env.production文件
echo 'SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here' >> .env.production

# 方式3：如果使用PM2
pm2 set SUPABASE_SERVICE_ROLE_KEY "your_service_role_key_here"
pm2 restart all
```

#### Vercel部署

1. 进入Vercel项目设置
2. 点击 `Settings` → `Environment Variables`
3. 添加新变量：
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: 你的service role key
   - Environments: 选择 `Production` 和 `Preview`
4. 点击 `Save`
5. 重新部署项目

#### Docker部署

在`docker-compose.yml`或启动命令中添加：

```yaml
# docker-compose.yml
services:
  app:
    environment:
      - SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

或：

```bash
docker run -e SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here" ...
```

### 步骤3：验证配置

重启应用后，查看日志应该看到：

```
[Supabase] Using service role key for server operations
```

而不是：

```
[Supabase] Warning: Using anon key, file uploads may fail
```

## 🔒 安全注意事项

### ⚠️ Service Role Key的安全性

**Service Role Key非常重要，它拥有完全的数据库和存储访问权限！**

1. **不要**提交到Git仓库
2. **不要**在前端代码中使用
3. **不要**公开分享
4. **只在**服务端使用
5. **定期**轮换密钥

### 检查.gitignore

确保`.gitignore`包含：

```
.env
.env.local
.env.production
.env.*.local
```

### 环境变量命名规则

- `NEXT_PUBLIC_*` - 可以在前端使用（公开）
- 无前缀 - 只能在服务端使用（私密）

**正确的配置：**
```env
# 前端可用（公开）
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# 仅服务端（私密）
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
OPENROUTER_API_KEY=sk-or-...
```

## 🧪 测试上传

配置完成后，测试上传：

### 测试1：上传小图片
1. 访问应用
2. 上传一个小PNG图片（<1MB）
3. 应该成功

### 测试2：上传PSD文件
1. 选择一个PSD文件
2. 上传
3. 应该成功并显示预览

### 测试3：上传PDF文件
1. 选择一个PDF文件
2. 上传
3. 应该成功并显示第一页预览

## 🔍 故障排查

### 问题1：还是500错误

**检查：**
```bash
# 确认环境变量已设置
echo $SUPABASE_SERVICE_ROLE_KEY

# 或在Node.js中
node -e "console.log(process.env.SUPABASE_SERVICE_ROLE_KEY)"
```

**如果为空：**
- 环境变量未正确设置
- 需要重启应用/服务器

### 问题2：日志显示"Using anon key"

**原因：**
- 环境变量未生效
- 变量名拼写错误
- 需要重启应用

**解决：**
```bash
# 重新设置并重启
export SUPABASE_SERVICE_ROLE_KEY="your_key"
pm2 restart all  # 或 npm start
```

### 问题3：403 Forbidden

**原因：**
- Service role key错误
- Supabase项目URL不匹配

**解决：**
- 重新从Dashboard复制正确的key
- 确认URL和key来自同一个项目

### 问题4：仍然无法上传

如果设置了service role key仍然失败，可能是Supabase存储桶策略问题。

**执行以下SQL（在Supabase SQL Editor）：**

```sql
-- 允许service_role完全访问material存储桶
CREATE POLICY "Service role full access"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'material')
WITH CHECK (bucket_id = 'material');

-- 确保存储桶是公共的
UPDATE storage.buckets
SET public = true
WHERE id = 'material';
```

## 📊 完整的环境变量清单

生产环境应该有以下环境变量：

```env
# Supabase配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...（公开密钥）
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...（私密密钥，新增）

# OpenRouter AI
OPENROUTER_API_KEY=sk-or-...

# 其他可选配置
NODE_ENV=production
PORT=3000
```

## 🚀 部署清单

在部署到生产环境前，确认：

- [ ] 已获取Service Role Key
- [ ] 已添加到环境变量
- [ ] 已重启应用
- [ ] 日志显示"Using service role key"
- [ ] 测试上传功能正常
- [ ] 检查.gitignore包含.env文件
- [ ] Service Role Key未提交到Git

## 📞 需要帮助？

如果问题仍未解决，请提供：

1. 服务器日志（隐藏敏感信息）
2. 环境变量是否设置成功
3. Supabase Dashboard中的存储桶策略截图
4. 上传文件的大小和类型

---

**重要提示：** 
- Service Role Key拥有完全权限，请妥善保管
- 配置完成后立即测试
- 定期检查Supabase的使用量和日志
