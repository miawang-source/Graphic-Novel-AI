# 🔧 环境变量配置指南

## 📋 必需的环境变量

### 1. Supabase 数据库配置

#### 获取 Supabase 配置：
1. 访问 [Supabase](https://supabase.com) 并登录
2. 选择您的项目（或创建新项目）
3. 进入 **Settings** → **API**
4. 复制以下信息：

```env
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 数据库表创建：
在 Supabase SQL Editor 中执行：

```sql
-- 1. 创建 scripts 表
CREATE TABLE scripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  analysis_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 创建 characters 表
CREATE TABLE characters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  role_type TEXT,
  chinese_prompt TEXT,
  english_prompt TEXT,
  candidate_materials JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 创建 scenes 表
CREATE TABLE scenes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  chinese_prompt TEXT,
  english_prompt TEXT,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 创建 materials 表
CREATE TABLE materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID,
  file_path TEXT,
  file_url TEXT,
  chinese_prompt TEXT,
  english_prompt TEXT,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 创建 categories 表
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 存储桶创建：
1. 进入 **Storage** 页面
2. 创建新桶：`materials`
3. 设置为 **Public** 访问
4. 配置上传策略

### 2. OpenRouter AI API 配置

#### 获取 OpenRouter API 密钥：
1. 访问 [OpenRouter](https://openrouter.ai)
2. 注册账户并登录
3. 进入 **API Keys** 页面
4. 点击 **Create Key**
5. 复制生成的密钥：

```env
# OpenRouter API 配置
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 支持的 AI 模型：
- `openrouter/sonoma-dusk-alpha` - 免费模型
- `google/gemini-pro-1.5` - 高质量模型
- `qwen/qwen-plus-2025-07-28` - 中文优化模型

### 3. 生产环境配置

```env
# 站点配置
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NODE_ENV=production

# 可选：日志级别
LOG_LEVEL=info
```

---

## 📁 环境文件配置

### 开发环境 (`.env.local`)
```env
# 开发环境配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NODE_ENV=development
```

### 生产环境 (`.env.production`)
```env
# 生产环境配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NODE_ENV=production
LOG_LEVEL=info
```

---

## 🔒 安全注意事项

### 环境变量安全：
- ✅ **永远不要**将 `.env` 文件提交到 Git
- ✅ **使用不同的密钥**用于开发和生产环境
- ✅ **定期轮换** API 密钥
- ✅ **限制 API 密钥权限**到最小必需范围

### Supabase 安全设置：
1. **启用 RLS (Row Level Security)**
2. **配置适当的访问策略**
3. **限制数据库访问权限**
4. **启用审计日志**

### OpenRouter 安全设置：
1. **设置使用限额**防止滥用
2. **监控 API 使用情况**
3. **配置告警**当使用量异常时

---

## 🚀 部署平台配置

### Vercel 部署：
1. 在 Vercel 项目设置中添加环境变量
2. 确保所有变量都正确设置
3. 重新部署以应用更改

### Docker 部署：
```bash
# 使用环境文件
docker run --env-file .env.production -p 3000:3000 ai-manga-tool
```

### 传统服务器：
```bash
# 设置环境变量
export NEXT_PUBLIC_SUPABASE_URL="your-url"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your-key"
export OPENROUTER_API_KEY="your-api-key"
export NEXT_PUBLIC_SITE_URL="https://yourdomain.com"

# 启动应用
npm start
```

---

## 🧪 配置验证

### 验证脚本：
创建 `verify-config.js`：

```javascript
// 验证环境变量配置
const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'OPENROUTER_API_KEY',
  'NEXT_PUBLIC_SITE_URL'
];

console.log('🔍 验证环境变量配置...\n');

let allValid = true;

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`❌ ${varName}: 未设置`);
    allValid = false;
  }
});

if (allValid) {
  console.log('\n🎉 所有环境变量配置正确！');
} else {
  console.log('\n⚠️ 请检查缺失的环境变量');
  process.exit(1);
}
```

运行验证：
```bash
node verify-config.js
```

### 健康检查：
部署后访问：`https://yourdomain.com/api/health`

预期响应：
```json
{
  "status": "healthy",
  "timestamp": "2025-09-17T10:00:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 15
    },
    "openrouter": {
      "status": "healthy",
      "responseTime": 120
    }
  }
}
```

---

## 🔧 故障排除

### 常见配置问题：

#### 1. Supabase 连接失败
```
错误：Invalid API key
解决：检查 SUPABASE_ANON_KEY 是否正确
```

#### 2. OpenRouter API 失败
```
错误：Unauthorized
解决：检查 OPENROUTER_API_KEY 格式和有效性
```

#### 3. CORS 错误
```
错误：CORS policy blocked
解决：确保 NEXT_PUBLIC_SITE_URL 设置正确
```

#### 4. 数据库表不存在
```
错误：relation "scripts" does not exist
解决：在 Supabase 中创建必需的表结构
```

---

## 📞 获取帮助

### 官方文档：
- [Supabase 文档](https://supabase.com/docs)
- [OpenRouter 文档](https://openrouter.ai/docs)
- [Next.js 环境变量](https://nextjs.org/docs/basic-features/environment-variables)

### 社区支持：
- [Supabase Discord](https://discord.supabase.com)
- [Next.js GitHub](https://github.com/vercel/next.js)

---

**🎯 配置完成后，您的应用就可以正常运行了！**

*记住：安全第一，永远不要在公共场所暴露您的 API 密钥！*
